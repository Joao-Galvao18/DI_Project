/* --- SIMULATION ENGINE (FINAL POLISH) --- */
class Simulation {
    constructor() {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Background Map Canvas
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        
        this.agents = [];
        this.terrainModifiers = []; 
        this.env = { temp: 25, pollution: 0 };
        this.viewMode = 'standard';
        this.isPlaying = true;
        this.isReviewing = false;
        this.selectedAgent = null; 
        
        this.history = []; 
        this.markers = []; 
        this.time = 0; 
        this.liveHead = 0; 
        this.pxPerUnit = 10;
        this.isScrubbing = false;

        this.mapOffsetX = 0;
        this.mapOffsetY = 0;

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.updateTimelineLayout(); 
        });
        this.bindEvents();
        this.initWorld(); 
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;
        this.renderMap();
        const timelineContainer = document.getElementById('timeline-scroll-area');
        if(timelineContainer) this.pxPerUnit = timelineContainer.clientWidth / 100;
    }

    // --- PROCEDURAL HEIGHT CALCULATOR ---
    getGlobalHeight(x, y) {
        const scale = 300;
        const nx = x + this.mapOffsetX;
        const ny = y + this.mapOffsetY;
        const v1 = Math.sin(nx/scale) * Math.cos(ny/scale);
        const v2 = Math.sin((nx+ny)/(scale*1.5)) * 0.5;
        const v3 = Math.cos((nx-ny)/(scale*2)) * 0.3;
        let h = (v1 + v2 + v3 + 2) / 4; 

        for (let mod of this.terrainModifiers) {
            const dx = x - mod.x;
            const dy = y - mod.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const radius = mod.size * 3.0; 
            
            if (dist < radius) {
                const norm = dist / radius; 
                const heightImpact = mod.size / 160; 
                const bump = (Math.cos(norm * Math.PI) + 1) / 2 * heightImpact; 
                h += bump;
            }
        }
        return Math.min(1.0, h);
    }

    // --- MAP RENDERER ---
    renderMap() {
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;
        const ctx = this.bgCtx;
        
        ctx.clearRect(0, 0, w, h);

        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#020617'); 
        gradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.filter = 'blur(20px)';
        
        const step = 15; 
        for(let y = 0; y < h; y += step) {
            for(let x = 0; x < w; x += step) {
                const val = this.getGlobalHeight(x, y);
                if(val > 0.6) {
                    ctx.fillStyle = `rgba(30, 58, 138, ${val - 0.5})`; 
                    ctx.beginPath();
                    ctx.arc(x, y, step * 1.5, 0, Math.PI*2);
                    ctx.fill();
                }
                if(val > 0.8) {
                    ctx.fillStyle = `rgba(56, 189, 248, 0.25)`; 
                    ctx.beginPath();
                    ctx.arc(x, y, step, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        for(let y = 0; y < h; y += 8) {
            for(let x = 0; x < w; x += 8) {
                const val = this.getGlobalHeight(x, y);
                if(Math.abs(val - 0.65) < 0.02 || Math.abs(val - 0.8) < 0.02) {
                    ctx.moveTo(x, y);
                    ctx.lineTo(x+2, y+2);
                }
            }
        }
        ctx.stroke();
    }

    updateTimelineLayout() {
        this.markers.forEach(m => { m.dom.style.left = (m.time * this.pxPerUnit) + 'px'; });
    }

    recordState() {
        const snapshot = {
            time: this.time,
            env: { ...this.env },
            agents: this.agents.map(a => ({ 
                id: a.id, type: a.type, x: a.x, y: a.y, 
                vx: a.vx, vy: a.vy, angle: a.angle, 
                health: a.health, size: a.size, subShapes: a.subShapes, poly: a.poly
            }))
        };
        this.history.push(snapshot);
        this.liveHead = this.time;
    }

    addMarker(time, label) {
        const dom = ui.addMarkerDOM(label);
        dom.style.left = (time * this.pxPerUnit) + 'px';
        this.markers.push({ time: time, dom: dom });
    }

    // --- REWRITE HISTORY ---
    rewriteHistory() {
        // Find index to cut
        let cutIndex = -1;
        for(let i=0; i<this.history.length; i++) {
            if(this.history[i].time >= this.time) {
                cutIndex = i;
                break;
            }
        }

        if(cutIndex !== -1) {
            // Remove future history
            this.history = this.history.slice(0, cutIndex);
            
            // Also remove markers that are in the future
            this.markers = this.markers.filter(m => {
                if(m.time > this.time) {
                    m.dom.remove();
                    return false;
                }
                return true;
            });
        }
        
        // Push current state as the new head
        this.recordState(); 
        
        this.liveHead = this.time;
        this.isReviewing = false;
        this.isPlaying = true;
        
        ui.setReviewMode(false);
        // UPDATED MESSAGE: Friendlier
        ui.showToast("You are Live! 🔴 New path started.");
        
        const btn = document.getElementById('btn-play');
        if(btn) btn.innerHTML = '<i class="ph ph-pause"></i>';
    }

    spawn(type, x, y) {
        if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
        
        const agent = new Agent(type, x, y);
        this.agents.push(agent);
        
        if(type === 'rock') {
            this.terrainModifiers.push({ x: x, y: y, size: agent.size });
            this.renderMap();
        }
        
        this.recordState();
    }

    spawnRandom(type) {
        if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        this.spawn(type, x, y);
    }

    initWorld() {
        this.agents = [];
        this.terrainModifiers = []; 
        this.time = 0; 
        this.liveHead = 0;
        this.history = [];
        this.markers = [];
        this.selectedAgent = null;
        ui.hideTooltip();
        ui.clearTimeline(); 
        
        const w = this.canvas.width, h = this.canvas.height;
        
        this.mapOffsetX = Math.random() * 10000;
        this.mapOffsetY = Math.random() * 10000;
        
        this.renderMap();

        this.env.temp = 25; this.env.pollution = 0;
        
        for(let i=0; i<2; i++) this.agents.push(new Agent('shark', Math.random()*w, Math.random()*h));
        for(let i=0; i<15; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
        for(let i=0; i<8; i++) this.agents.push(new Agent('shrimp', Math.random()*w, Math.random()*h));
        for(let i=0; i<25; i++) this.agents.push(new Agent('algae', Math.random()*w, Math.random()*h));
        for(let i=0; i<5; i++) this.agents.push(new Agent('coral', Math.random()*w, Math.random()*h));

        for(let i=0; i<8; i++) {
            const rx = Math.random() * w;
            const ry = Math.random() * h;
            const rock = new Agent('rock', rx, ry);
            this.agents.push(rock);
            this.terrainModifiers.push({ x: rx, y: ry, size: rock.size });
        }
        
        this.renderMap();
        
        this.syncSliders();
        this.recordState();
        this.addMarker(0, "Start");
        const scrollArea = document.getElementById('timeline-scroll-area');
        if(scrollArea) scrollArea.scrollLeft = 0;
        
        this.goLive();
    }

    syncSliders() {
        const tSlider = document.getElementById('slider-temp');
        const pSlider = document.getElementById('slider-pol');
        if(tSlider) { tSlider.value = this.env.temp; document.getElementById('val-temp').innerText = this.env.temp + "°C"; }
        if(pSlider) { pSlider.value = this.env.pollution; document.getElementById('val-pol').innerText = this.env.pollution + "%"; }
    }

    toggleView(mode) {
        this.viewMode = mode;
        const std = document.getElementById('view-std');
        const heat = document.getElementById('view-heat');
        if(std) std.classList.toggle('active', mode === 'standard');
        if(heat) heat.classList.toggle('active', mode === 'heatmap');
        ui.showToast(`View Mode: ${mode.toUpperCase()}`);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('btn-play');
        if(btn) {
            const icon = this.isPlaying ? '<i class="ph ph-pause"></i>' : '<i class="ph ph-play"></i>';
            btn.innerHTML = icon;
        }
    }

    scrub(e) {
        const track = document.getElementById('timeline-track');
        if(!track) return;
        const rect = track.getBoundingClientRect();
        
        let clientX = e.clientX;
        if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;

        let clickInsideTrack = clientX - rect.left;
        if (clickInsideTrack < 0) clickInsideTrack = 0;

        let clickedTime = clickInsideTrack / this.pxPerUnit;
        if (clickedTime > this.liveHead) clickedTime = this.liveHead;

        this.time = clickedTime;
        const fill = document.getElementById('timeline-fill');
        if(fill) fill.style.width = (this.time * this.pxPerUnit) + 'px';

        if (Math.abs(this.time - this.liveHead) > 0.5) {
            this.isReviewing = true;
            this.isPlaying = false; 
            const btn = document.getElementById('btn-play');
            if(btn) btn.innerHTML = '<i class="ph ph-play"></i>';
            ui.setReviewMode(true);
            this.applyInterpolation(); 
        } else {
            this.goLive();
        }
    }

    goLive() {
        const wasReviewing = this.isReviewing;
        this.isReviewing = false;
        ui.setReviewMode(false);
        const last = this.history[this.history.length-1];
        if(last) {
            this.time = last.time;
            this.env = { ...last.env };
            this.agents = last.agents.map(d => {
                const a = new Agent(d.type, d.x, d.y, d.health, d.id);
                if(d.size) a.size = d.size;
                if(d.subShapes) a.subShapes = d.subShapes; 
                if(d.poly) a.poly = d.poly; 
                
                a.vx = d.vx;
                a.vy = d.vy;
                a.angle = d.angle;

                return a;
            });
            this.syncSliders();
        }
        this.isPlaying = true;
        const btn = document.getElementById('btn-play');
        if(btn) btn.innerHTML = '<i class="ph ph-pause"></i>';
        if(wasReviewing) ui.showToast("🔴 LIVE");
    }

    bindEvents() {
        this.canvas.addEventListener('dragover', e => e.preventDefault());
        this.canvas.addEventListener('drop', e => {
            e.preventDefault();
            if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
            const rect = this.canvas.getBoundingClientRect();
            this.spawn(e.dataTransfer.getData("type"), e.clientX - rect.left, e.clientY - rect.top);
        });

        this.canvas.addEventListener('click', e => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            let found = null;
            for(let i = this.agents.length - 1; i >= 0; i--) {
                const a = this.agents[i];
                if(Math.hypot(a.x - clickX, a.y - clickY) < a.size * 1.5) {
                    found = a;
                    break;
                }
            }
            if(found) {
                this.selectedAgent = found;
                ui.selectedMode = true;
                ui.showTooltip(found.x, found.y, found);
            } else {
                this.selectedAgent = null;
                ui.selectedMode = false;
                ui.hideTooltip();
            }
        });

        this.canvas.addEventListener('mousemove', e => {
            if(ui.selectedMode) return; 
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            let hovered = false;
            for(let i = this.agents.length - 1; i >= 0; i--) {
                const a = this.agents[i];
                if(Math.hypot(a.x - mx, a.y - my) < a.size) {
                    ui.showTooltip(e.clientX, e.clientY, a);
                    hovered = true;
                    this.canvas.style.cursor = 'pointer';
                    break;
                }
            }
            if(!hovered) { ui.hideTooltip(); this.canvas.style.cursor = 'default'; }
        });

        const track = document.getElementById('timeline-track');
        if(track) {
            const startDrag = (e) => { this.isScrubbing = true; this.scrub(e); };
            track.addEventListener('mousedown', startDrag);
            track.addEventListener('touchstart', startDrag, {passive: false});
        }

        const moveDrag = (e) => { if(this.isScrubbing) { if(e.type === 'touchmove') e.preventDefault(); this.scrub(e); } };
        window.addEventListener('mousemove', moveDrag);
        window.addEventListener('touchmove', moveDrag, {passive: false});

        const endDrag = () => { this.isScrubbing = false; };
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchend', endDrag);

        const tempSlider = document.getElementById('slider-temp');
        if(tempSlider) {
            tempSlider.addEventListener('input', e => {
                if(this.isReviewing) return;
                this.env.temp = parseInt(e.target.value);
                document.getElementById('val-temp').innerText = this.env.temp + "°C";
            });
            tempSlider.addEventListener('change', e => {
                if(this.isReviewing) return;
                ui.showToast(`Temperature set to ${this.env.temp}°C`);
                this.addMarker(this.time, `Temp: ${this.env.temp}°C`);
                this.recordState();
            });
        }

        const polSlider = document.getElementById('slider-pol');
        if(polSlider) {
            polSlider.addEventListener('input', e => {
                if(this.isReviewing) return;
                this.env.pollution = parseInt(e.target.value);
                document.getElementById('val-pol').innerText = this.env.pollution + "%";
            });
            polSlider.addEventListener('change', e => {
                if(this.isReviewing) return;
                ui.showToast(`Pollution set to ${this.env.pollution}%`);
                this.addMarker(this.time, `Pollution: ${this.env.pollution}%`);
                this.recordState();
            });
        }
    }

    applyInterpolation() {
        let startIndex = -1;
        for(let i=0; i<this.history.length-1; i++) {
            if(this.history[i].time <= this.time && this.history[i+1].time > this.time) {
                startIndex = i;
                break;
            }
        }
        if(startIndex !== -1) {
            const snapA = this.history[startIndex];
            const snapB = this.history[startIndex+1];
            const t = (this.time - snapA.time) / (snapB.time - snapA.time);
            const tempAgents = [];
            
            snapA.agents.forEach(aStart => {
                const aEnd = snapB.agents.find(a => a.id === aStart.id);
                if(aEnd) {
                    const lerpX = aStart.x + (aEnd.x - aStart.x) * t;
                    const lerpY = aStart.y + (aEnd.y - aStart.y) * t;
                    
                    const dummy = new Agent(aStart.type, lerpX, lerpY, aStart.health, aStart.id);
                    if(aStart.size) dummy.size = aStart.size;
                    
                    if(aStart.subShapes) dummy.subShapes = aStart.subShapes;
                    if(aStart.poly) dummy.poly = aStart.poly;
                    
                    dummy.vx = aStart.vx + (aEnd.vx - aStart.vx) * t;
                    dummy.vy = aStart.vy + (aEnd.vy - aStart.vy) * t;
                    
                    if (Math.abs(dummy.vx) > 0.01 || Math.abs(dummy.vy) > 0.01) {
                        dummy.angle = Math.atan2(dummy.vy, dummy.vx);
                    } else {
                        dummy.angle = aStart.angle; 
                    }

                    dummy.dead = false; 
                    tempAgents.push(dummy);
                }
            });
            this.agents = tempAgents;
            this.env = snapA.env; 
            this.syncSliders();
        }
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.drawImage(this.bgCanvas, 0, 0);

        this.ctx.save();
        
        if(this.env.temp > 25) {
            const heat = (this.env.temp - 25) / 10; 
            this.ctx.fillStyle = `rgba(255, 50, 20, ${heat * 0.4})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if(this.env.pollution > 0) {
            const tox = this.env.pollution / 100;
            this.ctx.fillStyle = `rgba(100, 0, 150, ${tox * 0.6})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.ctx.restore();

        if(this.isPlaying) {
            if(!this.isReviewing) {
                this.time += 0.08; 
                
                // FIXED: Spawn rate lowered to 0.025 (less clutter)
                if(this.env.temp < 28 && this.env.pollution < 40 && Math.random() < 0.025) {
                    this.agents.push(new Agent('algae', Math.random()*this.canvas.width, Math.random()*this.canvas.height));
                }
                
                if(Math.floor(this.time) > Math.floor(this.time - 0.08)) { this.recordState(); }

                this.agents.forEach((a, i) => {
                    a.update(
                        {width: this.canvas.width, height: this.canvas.height}, 
                        this.env, 
                        this.agents,
                        (type, x, y) => this.spawn(type, x, y)
                    );

                    if(a.dead) {
                        if(this.selectedAgent === a) { this.selectedAgent = null; ui.selectedMode = false; ui.hideTooltip(); }
                        this.agents.splice(i, 1);
                    }
                });
                const scrollArea = document.getElementById('timeline-scroll-area');
                if(scrollArea) scrollArea.scrollLeft = scrollArea.scrollWidth;
                
                ui.updateStats(this.agents);
            } 
            else {
                this.time += 0.08;
                if(this.time >= this.liveHead) { this.goLive(); }
            }
        }

        if(this.isReviewing || this.isScrubbing) this.applyInterpolation();
        
        this.agents.forEach(a => a.draw(this.ctx, this.viewMode));

        if(this.selectedAgent) {
            const freshRef = this.agents.find(a => a.id === this.selectedAgent.id);
            if(freshRef) {
                this.selectedAgent = freshRef; 
                ui.showTooltip(freshRef.x, freshRef.y, freshRef);
            } else {
                this.selectedAgent = null; ui.selectedMode = false; ui.hideTooltip();
            }
        }

        const track = document.getElementById('timeline-track');
        if(track) {
            const maxTime = Math.max(100, this.liveHead); 
            track.style.minWidth = (maxTime * this.pxPerUnit) + 'px';
            const buff = document.getElementById('timeline-buffer');
            if(buff) buff.style.width = (this.liveHead * this.pxPerUnit) + 'px';
            const fill = document.getElementById('timeline-fill');
            if(fill) fill.style.width = (this.time * this.pxPerUnit) + 'px';
        }

        requestAnimationFrame(() => this.loop());
    }
}