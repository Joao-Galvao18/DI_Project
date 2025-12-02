/* --- UI CONTROLLER --- */
const ui = {
    sidebar: document.getElementById('sidebar'),
    sidebarLock: document.getElementById('sidebar-lock'),
    tooltip: document.getElementById('tooltip'),
    selectedMode: false,
    uiVisible: true,
    
    init: () => {
        document.getElementById('menu-toggle').onclick = () => ui.sidebar.classList.add('open');
        document.getElementById('close-menu').onclick = () => ui.sidebar.classList.remove('open');
        
        // Initialize Touch Drag System
        ui.setupTouchDrag();
    },

    toggleUI: () => {
        ui.uiVisible = !ui.uiVisible;
        const els = [document.getElementById('sidebar'), document.getElementById('menu-toggle'), document.getElementById('timeline-container')];
        els.forEach(el => {
            if(el) {
                if(ui.uiVisible) el.classList.remove('ui-hidden');
                else { el.classList.add('ui-hidden'); el.classList.remove('open'); }
            }
        });
    },

    switchTab: (tabName) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-content'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active-content');
        const btnIndex = tabName === 'environment' ? 0 : 1; 
        if(document.querySelectorAll('.tab-btn')[btnIndex]) {
            document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
        }
    },

    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        let color = '#38bdf8';
        if(type === 'alert') color = '#ef4444';
        if(type === 'success') color = '#22c55e';
        toast.style.borderLeftColor = color;
        toast.innerHTML = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    savePreset: () => { ui.showToast("✅ Configuration saved!", "success"); },
    drag: (ev, type) => { ev.dataTransfer.setData("type", type); },
    clickSpawn: (type) => { sim.spawnRandom(type); },
    
    showTooltip: (x, y, agent) => {
        ui.tooltip.style.left = x + 'px';
        ui.tooltip.style.top = y + 'px';
        ui.tooltip.classList.remove('hidden');
        document.getElementById('tt-type').innerText = agent.type.toUpperCase();
        
        let status = `Health: ${Math.round(agent.health)}%`;
        if(agent.type === 'oil') status = "Pollutant (Toxic)";
        document.getElementById('tt-health').innerText = status;
    },
    hideTooltip: () => { ui.tooltip.classList.add('hidden'); },

    // TIMELINE MARKERS
    addMarkerDOM: (label) => {
        const track = document.getElementById('timeline-track');
        const marker = document.createElement('div');
        marker.className = 't-marker';
        marker.setAttribute('data-label', label);
        track.appendChild(marker);
        return marker;
    },
    
    clearTimeline: () => {
        const track = document.getElementById('timeline-track');
        const markers = track.querySelectorAll('.t-marker');
        markers.forEach(m => m.remove());
    },

    setReviewMode: (isReviewing) => {
        if(isReviewing) {
            ui.sidebarLock.classList.remove('hidden');
            document.getElementById('btn-go-live').classList.remove('hidden');
        } else {
            ui.sidebarLock.classList.add('hidden');
            document.getElementById('btn-go-live').classList.add('hidden');
        }
    },

    // --- TOUCH DRAG SUPPORT FOR MOBILE ---
    setupTouchDrag: () => {
        const draggables = document.querySelectorAll('.draggable-item');
        let activeDrag = null;
        let dragType = null;
        let ghost = null;

        draggables.forEach(item => {
            // Extract type from onclick attribute just for safety, or we parse it manually
            // We'll rely on the attribute we set below
            const typeStr = item.getAttribute('ondragstart').match(/'([^']+)'/)[1];
            
            item.addEventListener('touchstart', (e) => {
                // Prevent sidebar scrolling while dragging an item
                // But allow scrolling if we aren't moving much? 
                // Simple approach: Lock if moving sideways, but for now we just capture.
                dragType = typeStr;
                activeDrag = item;
                
                // Create visual ghost
                ghost = item.cloneNode(true);
                ghost.style.position = 'absolute';
                ghost.style.opacity = '0.8';
                ghost.style.pointerEvents = 'none';
                ghost.style.zIndex = '1000';
                ghost.style.width = item.offsetWidth + 'px';
                ghost.style.background = '#1e293b';
                ghost.style.border = '1px solid #38bdf8';
                document.body.appendChild(ghost);

                const touch = e.touches[0];
                ghost.style.left = (touch.clientX - 20) + 'px';
                ghost.style.top = (touch.clientY - 20) + 'px';
            }, {passive: false});

            item.addEventListener('touchmove', (e) => {
                if(activeDrag && ghost) {
                    e.preventDefault(); // Stop screen scrolling
                    const touch = e.touches[0];
                    ghost.style.left = (touch.clientX - 20) + 'px';
                    ghost.style.top = (touch.clientY - 20) + 'px';
                }
            }, {passive: false});

            item.addEventListener('touchend', (e) => {
                if(activeDrag && ghost) {
                    const touch = e.changedTouches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    
                    // Check if dropped on Canvas
                    if(target && target.id === 'simCanvas') {
                        const rect = target.getBoundingClientRect();
                        sim.spawn(dragType, touch.clientX - rect.left, touch.clientY - rect.top);
                    }
                    
                    // Cleanup
                    ghost.remove();
                    ghost = null;
                    activeDrag = null;
                    dragType = null;
                }
            });
        });
    }
};

/* --- SIMULATION ENGINE WITH AI --- */
class Agent {
    constructor(type, x, y, health=100, id=null) {
        this.id = id || Math.random().toString(36).substr(2, 9); // Unique ID for interpolation
        this.type = type;
        this.x = x;
        this.y = y;
        this.health = health;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.dead = false;
        
        // Coral AI
        this.coralTimer = 0;    
        this.coralCooldown = 0; 
        this.lastCoral = null; 
        this.currentCoral = null; 
        
        // Restore Emoji Icons
        if(type === 'fish') { this.icon = '🐟'; this.size = 24; this.speed = 2; this.vision = 150; }
        else if (type === 'shark') { this.icon = '🦈'; this.size = 40; this.speed = 3.5; this.vision = 250; }
        else if (type === 'shrimp') { this.icon = '🦐'; this.size = 18; this.speed = 1; this.vision = 100; }
        else if (type === 'oil') { this.icon = '🛢️'; this.size = 20; this.speed = 0.2; this.vx *= 0.1; this.vy *= 0.1; }
        else if (type === 'algae') { this.icon = '🌿'; this.size = 15; this.speed = 0; this.vx=0; this.vy=0; }
        else if (type === 'coral') { this.icon = '🪸'; this.size = 30; this.speed = 0; this.vx=0; this.vy=0; }
    }

    findNearest(agents, targetType, excludeAgent = null) {
        let closest = null;
        let minDist = Infinity;
        for (let other of agents) {
            if (other === this || other.dead) continue;
            if (other.type !== targetType) continue;
            if (excludeAgent && other === excludeAgent) continue; 
            
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < minDist && (this.vision ? dist < this.vision : true)) {
                minDist = dist;
                closest = other;
            }
        }
        return { agent: closest, dist: minDist };
    }

    update(bounds, env, allAgents) {
        
        // --- FISH LOGIC ---
        if(this.type === 'fish') {
            this.health -= 0.01;
            if(env.pollution > 20) this.health -= 0.1;

            const predator = this.findNearest(allAgents, 'shark');
            
            if (predator.agent && predator.dist < 100) {
                if(this.currentCoral) this.lastCoral = this.currentCoral; 
                this.coralTimer = 0; 
                this.currentCoral = null;
                const dx = this.x - predator.agent.x;
                const dy = this.y - predator.agent.y;
                this.vx += (dx / predator.dist) * 0.5; 
                this.vy += (dy / predator.dist) * 0.5;
            } 
            else if (this.health < 50) {
                if(this.currentCoral) this.lastCoral = this.currentCoral; 
                this.coralTimer = 0; 
                this.currentCoral = null;
                const food = this.findNearest(allAgents, 'shrimp');
                if (food.agent) {
                    const dx = food.agent.x - this.x;
                    const dy = food.agent.y - this.y;
                    this.vx += (dx / food.dist) * 0.1;
                    this.vy += (dy / food.dist) * 0.1;
                    if (food.dist < 20) {
                        food.agent.dead = true;
                        this.health = 100; 
                    }
                }
            }
            else {
                if (this.coralTimer > 0) {
                    this.coralTimer--;
                    this.vx *= 0.9; 
                    this.vy *= 0.9;
                    this.vx += (Math.random() - 0.5) * 0.3; 
                    this.vy += (Math.random() - 0.5) * 0.3;
                    
                    if(this.coralTimer === 0) {
                        this.lastCoral = this.currentCoral; 
                        this.currentCoral = null;
                        this.coralCooldown = 600; 
                        this.vx += (Math.random() - 0.5) * 4;
                        this.vy += (Math.random() - 0.5) * 4;
                    }
                } 
                else if (this.coralCooldown <= 0) {
                    const coral = this.findNearest(allAgents, 'coral', this.lastCoral);
                    if (coral.agent && coral.dist < 150) {
                        const dx = coral.agent.x - this.x;
                        const dy = coral.agent.y - this.y;
                        this.vx += (dx / coral.dist) * 0.05;
                        this.vy += (dy / coral.dist) * 0.05;
                        
                        if(coral.dist < 40) {
                            this.coralTimer = 100; 
                            this.currentCoral = coral.agent;
                        }
                    }
                }
                
                if (this.coralCooldown > 0) this.coralCooldown--;
            }
        }

        // --- ALGAE ---
        else if(this.type === 'algae') {
            if(env.temp > 30) this.health -= 0.5;
            else if(env.temp < 28 && env.pollution < 40 && this.health < 100) this.health += 0.1;
        }

        // --- SHRIMP ---
        else if(this.type === 'shrimp') {
            this.health -= 0.005; 
            if(this.health < 80) { 
                const food = this.findNearest(allAgents, 'algae');
                if(food.agent) {
                    const dx = food.agent.x - this.x;
                    const dy = food.agent.y - this.y;
                    this.vx += (dx / food.dist) * 0.1;
                    this.vy += (dy / food.dist) * 0.1;
                    if(food.dist < 15) { food.agent.dead = true; this.health = 100; }
                }
            } else if(Math.random() < 0.02) {
                this.vx += (Math.random() - 0.5); this.vy += (Math.random() - 0.5);
            }
        }

        // --- SHARK ---
        else if (this.type === 'shark') {
            this.health -= 0.03; 
            if (this.health < 70) {
                const prey = this.findNearest(allAgents, 'fish');
                if (prey.agent) {
                    const dx = prey.agent.x - this.x;
                    const dy = prey.agent.y - this.y;
                    this.vx += (dx / prey.dist) * 0.2; 
                    this.vy += (dy / prey.dist) * 0.2;
                    if (prey.dist < (this.size + prey.agent.size) / 2) {
                        prey.agent.dead = true;
                        this.health = Math.min(100, this.health + 20);
                    }
                }
            }
        }

        // Physics
        const v = Math.hypot(this.vx, this.vy);
        if (v > this.speed && this.speed > 0) {
            this.vx = (this.vx / v) * this.speed;
            this.vy = (this.vy / v) * this.speed;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        const buffer = this.size / 2;
        if (this.x < buffer) { this.x = buffer; this.vx *= -1; }
        if (this.x > bounds.width - buffer) { this.x = bounds.width - buffer; this.vx *= -1; }
        if (this.y < buffer) { this.y = buffer; this.vy *= -1; }
        if (this.y > bounds.height - buffer) { this.y = bounds.height - buffer; this.vy *= -1; }
        
        if (this.health <= 0) this.dead = true;
    }

    draw(ctx, viewMode) {
        if(this.dead) return;
        if(viewMode === 'heatmap') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fillStyle = this.type === 'oil' ? 'black' : 'rgba(0, 255, 100, 0.4)';
            ctx.fill();
        } else {
            // Reverted to Emojis as requested
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.globalAlpha = this.health / 100;
            ctx.fillText(this.icon, this.x, this.y);
            ctx.globalAlpha = 1.0;
        }
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.agents = [];
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
        const timelineContainer = document.getElementById('timeline-scroll-area');
        if(timelineContainer) this.pxPerUnit = timelineContainer.clientWidth / 100;
    }

    updateTimelineLayout() {
        this.markers.forEach(m => { m.dom.style.left = (m.time * this.pxPerUnit) + 'px'; });
    }

    // --- SNAPSHOT SYSTEM ---
    recordState() {
        const snapshot = {
            time: this.time,
            env: { ...this.env },
            agents: this.agents.map(a => ({ 
                id: a.id,
                type: a.type, 
                x: a.x, 
                y: a.y, 
                health: a.health 
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

    spawn(type, x, y) {
        if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
        this.agents.push(new Agent(type, x, y));
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
        this.time = 0; 
        this.liveHead = 0;
        this.history = [];
        this.markers = [];
        this.selectedAgent = null;
        ui.hideTooltip();
        ui.clearTimeline(); 
        
        const w = this.canvas.width, h = this.canvas.height;
        
        this.env.temp = 25; this.env.pollution = 0;
        for(let i=0; i<15; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
        for(let i=0; i<5; i++) this.agents.push(new Agent('shrimp', Math.random()*w, Math.random()*h));
        for(let i=0; i<20; i++) this.agents.push(new Agent('algae', Math.random()*w, Math.random()*h));
        for(let i=0; i<5; i++) this.agents.push(new Agent('coral', Math.random()*w, Math.random()*h));
        
        this.syncSliders();
        this.recordState();
        this.addMarker(0, "Start");
        const scrollArea = document.getElementById('timeline-scroll-area');
        if(scrollArea) scrollArea.scrollLeft = 0;
        
        this.goLive();
    }

    syncSliders() {
        document.getElementById('slider-temp').value = this.env.temp;
        document.getElementById('val-temp').innerText = this.env.temp + "°C";
        document.getElementById('slider-pol').value = this.env.pollution;
        document.getElementById('val-pol').innerText = this.env.pollution + "%";
    }

    toggleView(mode) {
        this.viewMode = mode;
        document.getElementById('view-std').classList.toggle('active', mode === 'standard');
        document.getElementById('view-heat').classList.toggle('active', mode === 'heatmap');
        ui.showToast(`View Mode: ${mode.toUpperCase()}`);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const icon = this.isPlaying ? '<i class="ph ph-pause"></i>' : '<i class="ph ph-play"></i>';
        document.getElementById('btn-play').innerHTML = icon;
    }

    scrub(e) {
        if (e.type === 'touchmove' || e.type === 'touchstart') e.preventDefault();
        const track = document.getElementById('timeline-track');
        const rect = track.getBoundingClientRect();
        let clientX = e.clientX;
        if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
        let clickInsideTrack = clientX - rect.left;
        if (clickInsideTrack < 0) clickInsideTrack = 0;
        let clickedTime = clickInsideTrack / this.pxPerUnit;
        if (clickedTime > this.liveHead) clickedTime = this.liveHead;
        this.time = clickedTime;
        
        if (Math.abs(this.time - this.liveHead) > 0.5) {
            this.isReviewing = true;
            this.isPlaying = false; 
            document.getElementById('btn-play').innerHTML = '<i class="ph ph-play"></i>';
            ui.setReviewMode(true);
            this.applyInterpolation();
        } else {
            this.goLive();
        }
        document.getElementById('timeline-fill').style.width = (this.time * this.pxPerUnit) + 'px';
    }

    goLive() {
        this.isReviewing = false;
        ui.setReviewMode(false);
        const last = this.history[this.history.length-1];
        if(last) {
            this.time = last.time;
            this.env = { ...last.env };
            this.agents = last.agents.map(d => new Agent(d.type, d.x, d.y, d.health, d.id));
            this.syncSliders();
        }
        this.isPlaying = true;
        document.getElementById('btn-play').innerHTML = '<i class="ph ph-pause"></i>';
        ui.showToast("🔴 LIVE");
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
        track.addEventListener('click', e => this.scrub(e));
        track.addEventListener('touchstart', e => this.scrub(e), {passive: false});
        track.addEventListener('touchmove', e => this.scrub(e), {passive: false});

        document.getElementById('slider-temp').addEventListener('input', e => {
            if(this.isReviewing) return;
            this.env.temp = parseInt(e.target.value);
            document.getElementById('val-temp').innerText = this.env.temp + "°C";
        });
        document.getElementById('slider-temp').addEventListener('change', e => {
            if(this.isReviewing) return;
            ui.showToast(`Temperature set to ${this.env.temp}°C`);
            this.addMarker(this.time, `Temp: ${this.env.temp}°C`);
            this.recordState();
        });

        document.getElementById('slider-pol').addEventListener('input', e => {
            if(this.isReviewing) return;
            this.env.pollution = parseInt(e.target.value);
            document.getElementById('val-pol').innerText = this.env.pollution + "%";
        });
        document.getElementById('slider-pol').addEventListener('change', e => {
            if(this.isReviewing) return;
            ui.showToast(`Pollution set to ${this.env.pollution}%`);
            this.addMarker(this.time, `Pollution: ${this.env.pollution}%`);
            this.recordState();
        });
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
        
        const r = this.env.pollution * 1.5;
        const g = Math.max(50, 100 - (this.env.pollution));
        const b = Math.max(50, 200 - (this.env.pollution * 2));
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);

        if(this.isPlaying) {
            if(!this.isReviewing) {
                this.time += 0.05; 
                if(this.env.temp < 28 && this.env.pollution < 40 && Math.random() < 0.01) {
                    this.agents.push(new Agent('algae', Math.random()*this.canvas.width, Math.random()*this.canvas.height));
                }
                if(Math.floor(this.time) > Math.floor(this.time - 0.05)) { this.recordState(); }

                this.agents.forEach((a, i) => {
                    a.update({width: this.canvas.width, height: this.canvas.height}, this.env, this.agents);
                    if(a.dead) {
                        if(this.selectedAgent === a) { this.selectedAgent = null; ui.selectedMode = false; ui.hideTooltip(); }
                        this.agents.splice(i, 1);
                    }
                });
                const scrollArea = document.getElementById('timeline-scroll-area');
                if(scrollArea) scrollArea.scrollLeft = scrollArea.scrollWidth;
            } 
            else {
                this.time += 0.05;
                if(this.time >= this.liveHead) { this.goLive(); }
            }
        }

        if(this.isReviewing) this.applyInterpolation();
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
        const maxTime = Math.max(100, this.liveHead); 
        track.style.minWidth = (maxTime * this.pxPerUnit) + 'px';
        document.getElementById('timeline-buffer').style.width = (this.liveHead * this.pxPerUnit) + 'px';
        document.getElementById('timeline-fill').style.width = (this.time * this.pxPerUnit) + 'px';

        requestAnimationFrame(() => this.loop());
    }
}

ui.init();
const sim = new Simulation();