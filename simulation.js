/* --- UI CONTROLLER --- */
const ui = {
    sidebar: document.getElementById('sidebar'),
    sidebarLock: document.getElementById('sidebar-lock'),
    tooltip: document.getElementById('tooltip'),
    
    init: () => {
        document.getElementById('menu-toggle').onclick = () => ui.sidebar.classList.add('open');
        document.getElementById('close-menu').onclick = () => ui.sidebar.classList.remove('open');
    },

    switchTab: (tabName) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-content'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active-content');
        const btnIndex = tabName === 'scenarios' ? 0 : tabName === 'environment' ? 1 : 2;
        document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
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
        if(agent.type === 'food') status = "Edible";
        document.getElementById('tt-health').innerText = status;
    },
    hideTooltip: () => { ui.tooltip.classList.add('hidden'); },

    // TIMELINE MARKERS
    addMarkerDOM: (label) => {
        const track = document.getElementById('timeline-markers');
        const marker = document.createElement('div');
        marker.className = 't-marker';
        marker.setAttribute('data-label', label);
        track.appendChild(marker);
        return marker;
    },
    
    clearTimeline: () => {
        document.getElementById('timeline-markers').innerHTML = '';
    },

    setReviewMode: (isReviewing) => {
        if(isReviewing) {
            ui.sidebarLock.classList.remove('hidden');
            document.getElementById('btn-go-live').classList.remove('hidden');
        } else {
            ui.sidebarLock.classList.add('hidden');
            document.getElementById('btn-go-live').classList.add('hidden');
        }
    }
};

/* --- SIMULATION ENGINE WITH AI --- */
class Agent {
    constructor(type, x, y, health=100) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.health = health;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.dead = false;
        
        // Define size first for bounds checking
        if(type === 'fish') { this.icon = '🐟'; this.size = 24; this.speed = 2; this.vision = 150; }
        else if (type === 'shark') { this.icon = '🦈'; this.size = 40; this.speed = 3.5; this.vision = 250; }
        else if (type === 'food') { this.icon = '🦐'; this.size = 15; this.speed = 0.5; this.vx *= 0.2; this.vy *= 0.2; }
        else if (type === 'oil') { this.icon = '🛢️'; this.size = 20; this.speed = 0.2; this.vx *= 0.1; this.vy *= 0.1; }
        else if (type === 'coral') { this.icon = '🪸'; this.size = 30; this.speed = 0; this.vx = 0; this.vy = 0; }
    }

    findNearest(agents, targetType) {
        let closest = null;
        let minDist = Infinity;
        for (let other of agents) {
            if (other === this || other.dead) continue;
            if (other.type !== targetType) continue;
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < minDist && dist < this.vision) {
                minDist = dist;
                closest = other;
            }
        }
        return { agent: closest, dist: minDist };
    }

    update(bounds, env, allAgents) {
        // AI Logic (Steering)
        if (this.type === 'shark') {
            const prey = this.findNearest(allAgents, 'fish');
            if (prey.agent) {
                const dx = prey.agent.x - this.x;
                const dy = prey.agent.y - this.y;
                this.vx += (dx / prey.dist) * 0.2; 
                this.vy += (dy / prey.dist) * 0.2;
                if (prey.dist < (this.size + prey.agent.size) / 2) {
                    prey.agent.dead = true;
                    this.health = Math.min(100, this.health + 20);
                    ui.showToast('Shark ate a fish!', 'alert');
                }
            }
        } 
        else if (this.type === 'fish') {
            this.health -= 0.08; 
            const predator = this.findNearest(allAgents, 'shark');
            if (predator.agent && predator.dist < 100) {
                const dx = this.x - predator.agent.x;
                const dy = this.y - predator.agent.y;
                this.vx += (dx / predator.dist) * 0.5; 
                this.vy += (dy / predator.dist) * 0.5;
            } else {
                const food = this.findNearest(allAgents, 'food');
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
        }

        // Velocity Limiting
        const v = Math.hypot(this.vx, this.vy);
        if (v > this.speed) {
            this.vx = (this.vx / v) * this.speed;
            this.vy = (this.vy / v) * this.speed;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        // BOUNDARY CHECK (FIXED): Bounce off edges of body, not center
        // Prevents agents from going off-screen
        const buffer = this.size / 2;
        if (this.x < buffer) { this.x = buffer; this.vx *= -1; }
        if (this.x > bounds.width - buffer) { this.x = bounds.width - buffer; this.vx *= -1; }
        if (this.y < buffer) { this.y = buffer; this.vy *= -1; }
        if (this.y > bounds.height - buffer) { this.y = bounds.height - buffer; this.vy *= -1; }

        if (this.type === 'fish' || this.type === 'coral') {
            if (env.temp > 30) this.health -= 0.1;
            if (env.pollution > 20) this.health -= 0.2;
        }
        
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
        this.loadPreset('healthy'); 
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const timelineContainer = document.getElementById('timeline-scroll-area');
        this.pxPerUnit = timelineContainer.clientWidth / 100;
    }

    updateTimelineLayout() {
        this.markers.forEach(m => { m.dom.style.left = (m.time * this.pxPerUnit) + 'px'; });
    }

    recordState() {
        const snapshot = {
            time: this.time,
            env: { ...this.env },
            agents: this.agents.map(a => ({ type: a.type, x: a.x, y: a.y, health: a.health }))
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

    loadPreset(name) {
        this.agents = [];
        this.time = 0; 
        this.liveHead = 0;
        this.history = [];
        this.markers = [];
        this.goLive();
        ui.clearTimeline(); 
        
        const w = this.canvas.width, h = this.canvas.height;
        
        if(name === 'healthy') {
            this.env.temp = 25; this.env.pollution = 0;
            for(let i=0; i<15; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
            for(let i=0; i<3; i++) this.agents.push(new Agent('food', Math.random()*w, Math.random()*h));
            ui.showToast("Preset: Healthy Reef");
            this.addMarker(0, "Start: Healthy");
        } else if (name === 'threatened') {
            this.env.temp = 31; this.env.pollution = 40;
            for(let i=0; i<8; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
            for(let i=0; i<10; i++) this.agents.push(new Agent('oil', Math.random()*w, Math.random()*h));
            ui.showToast("Preset: Threatened");
            this.addMarker(0, "Start: Threatened");
        } else if (name === 'recovery') {
            this.env.temp = 27; this.env.pollution = 10;
            for(let i=0; i<10; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
            for(let i=0; i<5; i++) this.agents.push(new Agent('food', Math.random()*w, Math.random()*h));
            ui.showToast("Preset: Recovery");
            this.addMarker(0, "Start: Recovery");
        }
        
        this.syncSliders();
        this.recordState();
        document.getElementById('timeline-scroll-area').scrollLeft = 0;
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
        document.getElementById('btn-play').innerText = this.isPlaying ? "⏸" : "▶";
    }

    scrub(e) {
        const container = document.getElementById('timeline-scroll-area');
        const rect = container.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + container.scrollLeft;
        
        let clickedTime = offsetX / this.pxPerUnit;
        if(clickedTime < 0) clickedTime = 0;
        if(clickedTime > this.liveHead) clickedTime = this.liveHead;

        this.time = clickedTime;
        
        if(Math.abs(this.time - this.liveHead) > 0.5) {
            this.isReviewing = true;
            this.isPlaying = false; 
            document.getElementById('btn-play').innerText = "▶";
            ui.setReviewMode(true);
            
            let snapshot = this.history[0];
            for(let i=this.history.length-1; i>=0; i--) {
                if(this.history[i].time <= clickedTime) {
                    snapshot = this.history[i];
                    break;
                }
            }
            if(snapshot) {
                this.env = { ...snapshot.env };
                this.agents = snapshot.agents.map(d => new Agent(d.type, d.x, d.y, d.health));
                this.syncSliders();
            }
            ui.showToast(`Rewound to ${Math.round(this.time)}`);
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
            this.agents = last.agents.map(d => new Agent(d.type, d.x, d.y, d.health));
            this.syncSliders();
        }
        this.isPlaying = true;
        document.getElementById('btn-play').innerText = "⏸";
        ui.showToast("LIVE");
    }

    bindEvents() {
        this.canvas.addEventListener('dragover', e => e.preventDefault());
        this.canvas.addEventListener('drop', e => {
            e.preventDefault();
            if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
            const rect = this.canvas.getBoundingClientRect();
            this.spawn(e.dataTransfer.getData("type"), e.clientX - rect.left, e.clientY - rect.top);
        });

        this.canvas.addEventListener('mousemove', e => {
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

        document.getElementById('slider-temp').addEventListener('input', e => {
            if(this.isReviewing) return;
            this.env.temp = parseInt(e.target.value);
            document.getElementById('val-temp').innerText = this.env.temp + "°C";
        });
        document.getElementById('slider-temp').addEventListener('change', e => {
            if(this.isReviewing) return;
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
            this.addMarker(this.time, `Pollution: ${this.env.pollution}%`);
            this.recordState();
        });
    }

    loop() {
        if(this.isPlaying) {
            if(!this.isReviewing) {
                this.time += 0.05;
                if(Math.floor(this.time) > Math.floor(this.time - 0.05)) {
                    this.recordState();
                }

                this.agents.forEach((a, i) => {
                    a.update({width: this.canvas.width, height: this.canvas.height}, this.env, this.agents);
                    if(a.dead) this.agents.splice(i, 1);
                });

                const scrollArea = document.getElementById('timeline-scroll-area');
                scrollArea.scrollLeft = scrollArea.scrollWidth;
            } 
            else {
                this.time += 0.05;
                if(this.time >= this.liveHead) {
                    this.goLive();
                    requestAnimationFrame(() => this.loop());
                    return; 
                }
                this.agents.forEach((a, i) => {
                    a.update({width: this.canvas.width, height: this.canvas.height}, this.env, this.agents);
                    if(a.dead) this.agents.splice(i, 1);
                });
            }
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const r = this.env.pollution * 1.5;
        const g = Math.max(50, 100 - (this.env.pollution));
        const b = Math.max(50, 200 - (this.env.pollution * 2));
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);

        this.agents.forEach(a => a.draw(this.ctx, this.viewMode));

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