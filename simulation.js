/* --- UI CONTROLLER --- */
const ui = {
    sidebar: document.getElementById('sidebar'),
    sidebarLock: document.getElementById('sidebar-lock'),
    tooltip: document.getElementById('tooltip'),
    selectedMode: false,
    uiVisible: true,
    statsDOM: {}, 
    
    init: () => {
        const toggle = document.getElementById('menu-toggle');
        if(toggle) toggle.onclick = () => ui.sidebar.classList.add('open');
        
        const close = document.getElementById('close-menu');
        if(close) close.onclick = () => ui.sidebar.classList.remove('open');
        
        ui.injectRockButton();
        ui.setupTouchDrag();
        ui.initStats();
    },

    injectRockButton: () => {
        const container = document.getElementById('tab-species');
        if(!container) return;
        if(!container.querySelector('.rock-btn')) {
            const div = document.createElement('div');
            div.className = 'draggable-item rock-btn';
            div.setAttribute('draggable', 'true');
            div.onclick = () => sim.spawnRandom('rock');
            div.innerHTML = `<i class="ph ph-hexagon icon" style="color:#94a3b8"></i> <span>Rock (Mountain)</span>`;
            div.addEventListener('dragstart', (e) => ui.drag(e, 'rock'));
            container.appendChild(div);
        }
    },

    initStats: () => {
        const bar = document.createElement('div');
        bar.id = 'stats-bar';
        Object.assign(bar.style, {
            position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '15px', background: 'rgba(15, 23, 42, 0.8)', padding: '8px 20px',
            borderRadius: '99px', color: 'white', fontFamily: 'Arial, sans-serif',
            fontSize: '14px', fontWeight: 'bold', border: '1px solid rgba(56, 189, 248, 0.3)',
            zIndex: '500', pointerEvents: 'none', userSelect: 'none'
        });

        const types = [
            { id: 'fish', icon: '🐟' },
            { id: 'shark', icon: '🦈' },
            { id: 'shrimp', icon: '🦐' },
            { id: 'algae', icon: '🌿' },
            { id: 'coral', icon: '🪸' },
            { id: 'rock', icon: '🪨', color: '#94a3b8' } 
        ];

        types.forEach(t => {
            const item = document.createElement('div');
            const color = t.color || '#38bdf8';
            item.innerHTML = `${t.icon} <span id="stat-${t.id}" style="color:${color}">0</span>`;
            bar.appendChild(item);
            ui.statsDOM[t.id] = item.querySelector('span');
        });
        document.body.appendChild(bar);
    },

    updateStats: (agents) => {
        const counts = { fish: 0, shark: 0, shrimp: 0, algae: 0, coral: 0, rock: 0 };
        for(let agent of agents) {
            if(counts[agent.type] !== undefined) counts[agent.type]++;
        }
        for (const [type, count] of Object.entries(counts)) {
            if(ui.statsDOM[type]) ui.statsDOM[type].innerText = count;
        }
    },

    toggleUI: () => {
        ui.uiVisible = !ui.uiVisible;
        const els = [document.getElementById('sidebar'), document.getElementById('menu-toggle'), document.getElementById('timeline-container'), document.getElementById('stats-bar')];
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
        const content = document.getElementById(`tab-${tabName}`);
        if(content) content.classList.add('active-content');
        
        const btnIndex = tabName === 'environment' ? 0 : 1; 
        if(document.querySelectorAll('.tab-btn')[btnIndex]) {
            document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
        }
    },

    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toast-container');
        if(!container) return;
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
        if(agent.type === 'rock') status = "Structure";
        document.getElementById('tt-health').innerText = status;
    },
    hideTooltip: () => { ui.tooltip.classList.add('hidden'); },

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
        if(!track) return;
        const markers = track.querySelectorAll('.t-marker');
        markers.forEach(m => m.remove());
    },

    setReviewMode: (isReviewing) => {
        const goLive = document.getElementById('btn-go-live');
        if(isReviewing) {
            ui.sidebarLock.classList.remove('hidden');
            if(goLive) goLive.classList.remove('hidden');
        } else {
            ui.sidebarLock.classList.add('hidden');
            if(goLive) goLive.classList.add('hidden');
        }
    },

    setupTouchDrag: () => {
        setTimeout(() => {
            const draggables = document.querySelectorAll('.draggable-item');
            let activeDrag = null;
            let dragType = null;
            let ghost = null;

            draggables.forEach(item => {
                let typeStr = null;
                const attr = item.getAttribute('ondragstart');
                if(attr) {
                    typeStr = attr.match(/'([^']+)'/)[1];
                } else if (item.classList.contains('rock-btn')) {
                    typeStr = 'rock';
                }

                if(!typeStr) return;
                
                item.addEventListener('touchstart', (e) => {
                    dragType = typeStr;
                    activeDrag = item;
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
                        e.preventDefault(); 
                        const touch = e.touches[0];
                        ghost.style.left = (touch.clientX - 20) + 'px';
                        ghost.style.top = (touch.clientY - 20) + 'px';
                    }
                }, {passive: false});

                item.addEventListener('touchend', (e) => {
                    if(activeDrag && ghost) {
                        const touch = e.changedTouches[0];
                        const target = document.elementFromPoint(touch.clientX, touch.clientY);
                        if(target && target.id === 'simCanvas') {
                            const rect = target.getBoundingClientRect();
                            sim.spawn(dragType, touch.clientX - rect.left, touch.clientY - rect.top);
                        }
                        ghost.remove();
                        ghost = null;
                        activeDrag = null;
                        dragType = null;
                    }
                });
            });
        }, 100);
    }
};

/* --- SIMULATION ENGINE --- */
class Agent {
    constructor(type, x, y, health=100, id=null) {
        this.id = id || Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.health = health;
        
        // Random velocity
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        
        // Store orientation explicitly
        this.angle = Math.atan2(this.vy, this.vx); 
        
        this.dead = false;
        this.subShapes = []; 

        this.coralTimer = 0;    
        this.coralCooldown = 0; 
        this.lastCoral = null; 
        this.currentCoral = null; 
        this.reproCooldown = 0;
        
        // --- VISUAL CONFIGURATION (Top Down Vectors) ---
        if(type === 'fish') { 
            this.size = 12; // Radius
            this.color = '#38bdf8'; // Cyan
            this.speed = 2; this.vision = 150; 
        }
        else if (type === 'shark') { 
            this.size = 22; 
            this.color = '#94a3b8'; // Slate Gray
            this.speed = 3.5; this.vision = 250; 
        }
        else if (type === 'shrimp') { 
            this.size = 6; 
            this.color = '#fb7185'; // Rose/Pink
            this.speed = 1; this.vision = 100; 
        }
        else if (type === 'algae') { 
            this.size = 8; 
            this.color = '#4ade80'; // Green
            this.speed = 0; this.vx=0; this.vy=0; 
            // Generate organic clump data once
            for(let i=0; i<5; i++) {
                 this.subShapes.push({
                     ox: (Math.random() - 0.5) * this.size * 1.2, // Offset X
                     oy: (Math.random() - 0.5) * this.size * 1.2, // Offset Y
                     r: this.size * (0.4 + Math.random() * 0.4)   // Radius fraction
                 });
            }
        }
        else if (type === 'coral') { 
            this.size = 18; 
            this.color = '#a78bfa'; // Purple
            this.speed = 0; this.vx=0; this.vy=0; 
            // Generate organic branch data once
            const branches = 5 + Math.floor(Math.random() * 4);
            for(let i=0; i<branches; i++) {
                 const angle = Math.random() * Math.PI * 2;
                 const dist = this.size * (0.4 + Math.random() * 0.6);
                 this.subShapes.push({
                     ox: Math.cos(angle) * dist,
                     oy: Math.sin(angle) * dist,
                     r: this.size * (0.25 + Math.random() * 0.35)
                 });
            }
        }
        else if (type === 'rock') { 
            this.size = 25 + Math.random() * 55; 
            this.color = '#1e293b'; // Dark structural gray
            this.speed = 0; this.vx=0; this.vy=0; 
            
            // Generate a random polygon shape
            this.poly = [];
            const sides = 6 + Math.floor(Math.random() * 4);
            for(let i=0; i<sides; i++) {
                const angle = (i / sides) * Math.PI * 2;
                const r = this.size * (0.8 + Math.random() * 0.4);
                this.poly.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
            }
        }
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

    update(bounds, env, allAgents, spawnCallback) {
        if(this.type === 'rock') return; 

        // Collision with Rocks
        for(let other of allAgents) {
            if(other.type === 'rock') {
                const dist = Math.hypot(this.x - other.x, this.y - other.y);
                const minDist = this.size + (other.size * 0.8); // Adjusted collision radius
                
                if(dist < minDist) {
                    const nx = (this.x - other.x) / dist;
                    const ny = (this.y - other.y) / dist;
                    const overlap = minDist - dist;
                    this.x += nx * overlap;
                    this.y += ny * overlap;
                    const dot = this.vx * nx + this.vy * ny;
                    this.vx = this.vx - 2 * dot * nx;
                    this.vy = this.vy - 2 * dot * ny;
                    this.vx *= 0.9;
                    this.vy *= 0.9;
                }
            }
        }

        // --- BEHAVIOR (Standard Logic) ---
        if(this.type === 'fish') {
            this.health -= 0.01;
            if(env.pollution > 20) this.health -= 0.1;
            const predator = this.findNearest(allAgents, 'shark');
            if (predator.agent && predator.dist < 100) {
                if(this.currentCoral) this.lastCoral = this.currentCoral; 
                this.coralTimer = 0; this.currentCoral = null;
                const dx = this.x - predator.agent.x;
                const dy = this.y - predator.agent.y;
                this.vx += (dx / predator.dist) * 0.5; 
                this.vy += (dy / predator.dist) * 0.5;
            } 
            else if (this.health < 50) {
                if(this.currentCoral) this.lastCoral = this.currentCoral; 
                this.coralTimer = 0; this.currentCoral = null;
                const food = this.findNearest(allAgents, 'shrimp');
                if (food.agent) {
                    const dx = food.agent.x - this.x;
                    const dy = food.agent.y - this.y;
                    this.vx += (dx / food.dist) * 0.1;
                    this.vy += (dy / food.dist) * 0.1;
                    if (food.dist < 20) { food.agent.dead = true; this.health = 100; }
                }
            }
            else {
                if (this.coralTimer > 0) {
                    this.coralTimer--;
                    this.vx *= 0.9; this.vy *= 0.9;
                    this.vx += (Math.random() - 0.5) * 0.3; this.vy += (Math.random() - 0.5) * 0.3;
                    if(this.coralTimer === 0) {
                        this.lastCoral = this.currentCoral; this.currentCoral = null;
                        this.coralCooldown = 600; 
                        this.vx += (Math.random() - 0.5) * 4; this.vy += (Math.random() - 0.5) * 4;
                    }
                } 
                else if (this.coralCooldown <= 0) {
                    const coral = this.findNearest(allAgents, 'coral', this.lastCoral);
                    if (coral.agent && coral.dist < 150) {
                        const dx = coral.agent.x - this.x;
                        const dy = coral.agent.y - this.y;
                        this.vx += (dx / coral.dist) * 0.05;
                        this.vy += (dy / coral.dist) * 0.05;
                        if(coral.dist < 40) { this.coralTimer = 100; this.currentCoral = coral.agent; }
                    }
                }
                if (this.coralCooldown > 0) this.coralCooldown--;
            }
        }
        else if(this.type === 'algae') {
            if(env.temp > 30) this.health -= 0.5;
            else if(env.temp < 28 && env.pollution < 40 && this.health < 100) this.health += 0.1;
        }
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
        else if (this.type === 'shark') {
            this.health -= 0.03; 
            if (this.health < 70) {
                const prey = this.findNearest(allAgents, 'fish');
                if (prey.agent) {
                    const dx = prey.agent.x - this.x;
                    const dy = prey.agent.y - this.y;
                    this.vx += (dx / prey.dist) * 0.2; 
                    this.vy += (dy / prey.dist) * 0.2;
                    if (prey.dist < (this.size + prey.agent.size)) { // Adjusted for graphic size
                        prey.agent.dead = true;
                        this.health = Math.min(100, this.health + 20);
                    }
                }
            }
        }

        // Reproduction
        if(this.reproCooldown > 0) {
            this.reproCooldown--;
        } else if (['fish', 'shark', 'shrimp'].includes(this.type) && this.health >= 80) {
            const mateInfo = this.findNearest(allAgents, this.type);
            if (mateInfo.agent && mateInfo.dist < this.size * 3 && mateInfo.agent.health >= 95 && mateInfo.agent.reproCooldown <= 0) {
                if(Math.random() < 0.5) {
                    if(spawnCallback) spawnCallback(this.type, this.x, this.y);
                    this.reproCooldown = 400; 
                    mateInfo.agent.reproCooldown = 400;
                    this.vx *= -1; this.vy *= -1;
                } else {
                    this.reproCooldown = 50;
                }
            }
        }

        const v = Math.hypot(this.vx, this.vy);
        if (v > this.speed && this.speed > 0) {
            this.vx = (this.vx / v) * this.speed;
            this.vy = (this.vy / v) * this.speed;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        // Update angle only if moving (to prevent spinning when stopped)
        if (v > 0.1) {
            this.angle = Math.atan2(this.vy, this.vx);
        }

        // Bounds
        if (this.x < this.size) { this.x = this.size; this.vx *= -1; }
        if (this.x > bounds.width - this.size) { this.x = bounds.width - this.size; this.vx *= -1; }
        if (this.y < this.size) { this.y = this.size; this.vy *= -1; }
        if (this.y > bounds.height - this.size) { this.y = bounds.height - this.size; this.vy *= -1; }
        
        if (this.health <= 0) this.dead = true;
    }

    // --- VECTOR DRAWING METHOD (TOP DOWN) ---
    draw(ctx, viewMode) {
        if(this.dead) return;

        if(viewMode === 'heatmap') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fillStyle = this.type === 'oil' ? 'black' : 'rgba(0, 255, 100, 0.4)';
            ctx.fill();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.health / 100;
        
        // STATIC AGENTS (No rotation)
        if (this.type === 'algae') {
            ctx.fillStyle = this.color;
            // Draw organic clump using pre-calculated offsets
            this.subShapes.forEach(sub => {
                 ctx.beginPath();
                 ctx.arc(sub.ox, sub.oy, sub.r, 0, Math.PI*2);
                 ctx.fill();
            });
             // Central binder
            ctx.beginPath();
            ctx.arc(0, 0, this.size*0.5, 0, Math.PI*2);
            ctx.fill();
        } 
        else if (this.type === 'coral') {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            
            // Draw Base
            ctx.beginPath();
            ctx.arc(0, 0, this.size*0.6, 0, Math.PI*2);
            ctx.fill();
            
            // Draw organic branches
            this.subShapes.forEach(sub => {
                 ctx.beginPath();
                 ctx.arc(sub.ox, sub.oy, sub.r, 0, Math.PI*2);
                 ctx.fill();
                 ctx.stroke();
            });
        }
        else if (this.type === 'rock') {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (this.poly && this.poly.length > 0) {
                ctx.moveTo(this.poly[0].x, this.poly[0].y);
                for (let i = 1; i < this.poly.length; i++) {
                    ctx.lineTo(this.poly[i].x, this.poly[i].y);
                }
            } else {
                ctx.arc(0, 0, this.size, 0, Math.PI*2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
        // MOVING AGENTS (Rotate to face velocity)
        else {
            // Use stored angle
            ctx.rotate(this.angle);

            if (this.type === 'fish') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                // Teardrop shape (Top down view)
                ctx.ellipse(0, 0, this.size, this.size/2, 0, 0, Math.PI*2);
                ctx.fill();
                // Tail
                ctx.beginPath();
                ctx.moveTo(-this.size, 0);
                ctx.lineTo(-this.size - 8, -6);
                ctx.lineTo(-this.size - 8, 6);
                ctx.fill();
            }
            else if (this.type === 'shark') {
                ctx.fillStyle = this.color;
                // Main Body
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size/2.5, 0, 0, Math.PI*2);
                ctx.fill();
                
                // Pectoral Fins (Triangles sticking out)
                ctx.beginPath();
                ctx.moveTo(this.size * 0.2, this.size/3);
                ctx.lineTo(-this.size * 0.2, this.size);
                ctx.lineTo(-this.size * 0.2, this.size/3);
                ctx.fill(); // Right fin
                
                ctx.beginPath();
                ctx.moveTo(this.size * 0.2, -this.size/3);
                ctx.lineTo(-this.size * 0.2, -this.size);
                ctx.lineTo(-this.size * 0.2, -this.size/3);
                ctx.fill(); // Left fin

                // Tail (Crescent)
                ctx.beginPath();
                ctx.moveTo(-this.size, 0);
                ctx.lineTo(-this.size - 15, -10);
                ctx.lineTo(-this.size - 5, 0);
                ctx.lineTo(-this.size - 15, 10);
                ctx.fill();
            }
            else if (this.type === 'shrimp') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size/2, 0, 0, Math.PI*2);
                ctx.fill();
                // Antennae
                ctx.strokeStyle = '#fca5a5';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.size, 0);
                ctx.lineTo(this.size + 10, -5);
                ctx.moveTo(this.size, 0);
                ctx.lineTo(this.size + 10, 5);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Background Map Canvas
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        
        this.agents = [];
        this.terrainModifiers = []; // Stores rocks as data points that alter terrain
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

    // --- PROCEDURAL HEIGHT CALCULATOR (PROPORTIONAL TO ROCK SIZE) ---
    getGlobalHeight(x, y) {
        // 1. Base Noise
        const scale = 300;
        const nx = x + this.mapOffsetX;
        const ny = y + this.mapOffsetY;
        const v1 = Math.sin(nx/scale) * Math.cos(ny/scale);
        const v2 = Math.sin((nx+ny)/(scale*1.5)) * 0.5;
        const v3 = Math.cos((nx-ny)/(scale*2)) * 0.3;
        let h = (v1 + v2 + v3 + 2) / 4; 

        // 2. Add Terrain Modifiers (Rocks act as mountains)
        for (let mod of this.terrainModifiers) {
            const dx = x - mod.x;
            const dy = y - mod.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Influence radius is proportional to rock size
            const radius = mod.size * 3.0; 
            
            if (dist < radius) {
                // Cosine curve for smooth topographical blending
                const norm = dist / radius; 
                
                // Height impact is proportional to rock size.
                const heightImpact = mod.size / 160; 
                
                // height additive (max at center, 0 at edge)
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

        // 1. Base Water Layer
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#020617'); 
        gradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // 2. Render Blobs based on getGlobalHeight
        ctx.save();
        ctx.filter = 'blur(20px)';
        
        const step = 15; 
        for(let y = 0; y < h; y += step) {
            for(let x = 0; x < w; x += step) {
                const val = this.getGlobalHeight(x, y);
                
                // Deep Ridge
                if(val > 0.6) {
                    ctx.fillStyle = `rgba(30, 58, 138, ${val - 0.5})`; 
                    ctx.beginPath();
                    ctx.arc(x, y, step * 1.5, 0, Math.PI*2);
                    ctx.fill();
                }
                // Shallow / Land
                if(val > 0.8) {
                    ctx.fillStyle = `rgba(56, 189, 248, 0.25)`; 
                    ctx.beginPath();
                    ctx.arc(x, y, step, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();

        // 3. Render Contour Lines (Isolines)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        
        // A bit coarser step for lines to save CPU
        for(let y = 0; y < h; y += 8) {
            for(let x = 0; x < w; x += 8) {
                const val = this.getGlobalHeight(x, y);
                // Draw lines at specific heights
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
            // Record Angle and Velocity to prevent spinning on rewind
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

    spawn(type, x, y) {
        if(this.isReviewing) { ui.showToast("Cannot edit past! Go Live first.", "alert"); return; }
        
        const agent = new Agent(type, x, y);
        this.agents.push(agent);
        
        // --- DYNAMIC TERRAIN UPDATE ---
        if(type === 'rock') {
            // 1. Add rock to topological data
            this.terrainModifiers.push({ x: x, y: y, size: agent.size });
            // 2. Re-render the map to show new contours/depths
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
        this.terrainModifiers = []; // Reset terrain
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
        
        // Generate Base Map
        this.renderMap();

        this.env.temp = 25; this.env.pollution = 0;
        
        // Default Agents
        for(let i=0; i<2; i++) this.agents.push(new Agent('shark', Math.random()*w, Math.random()*h));
        for(let i=0; i<15; i++) this.agents.push(new Agent('fish', Math.random()*w, Math.random()*h));
        for(let i=0; i<5; i++) this.agents.push(new Agent('shrimp', Math.random()*w, Math.random()*h));
        for(let i=0; i<20; i++) this.agents.push(new Agent('algae', Math.random()*w, Math.random()*h));
        for(let i=0; i<5; i++) this.agents.push(new Agent('coral', Math.random()*w, Math.random()*h));

        // Spawn Rocks and UPDATE TERRAIN for each
        for(let i=0; i<8; i++) {
            const rx = Math.random() * w;
            const ry = Math.random() * h;
            // Create agent
            const rock = new Agent('rock', rx, ry);
            this.agents.push(rock);
            // Add to terrain data
            this.terrainModifiers.push({ x: rx, y: ry, size: rock.size });
        }
        
        // Final render after initial rocks
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
                if(d.subShapes) a.subShapes = d.subShapes; // Restore organic shapes
                if(d.poly) a.poly = d.poly; // Restore rock shape
                
                // Restore velocity and angle from history
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
                    
                    // Restore organic data
                    if(aStart.subShapes) dummy.subShapes = aStart.subShapes;
                    if(aStart.poly) dummy.poly = aStart.poly;
                    
                    // Interpolate Velocity and Angle to prevent spinning
                    dummy.vx = aStart.vx + (aEnd.vx - aStart.vx) * t;
                    dummy.vy = aStart.vy + (aEnd.vy - aStart.vy) * t;
                    
                    if (Math.abs(dummy.vx) > 0.01 || Math.abs(dummy.vy) > 0.01) {
                        dummy.angle = Math.atan2(dummy.vy, dummy.vx);
                    } else {
                        // If speed is near zero, use the last recorded angle
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
        
        // DRAW THE PROCEDURALLY GENERATED MAP
        this.ctx.drawImage(this.bgCanvas, 0, 0);

        // --- DYNAMIC COLOR OVERLAYS ---
        this.ctx.save();
        
        // Temperature Overlay
        if(this.env.temp > 25) {
            const heat = (this.env.temp - 25) / 10; 
            this.ctx.fillStyle = `rgba(255, 50, 20, ${heat * 0.4})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Pollution Overlay
        if(this.env.pollution > 0) {
            const tox = this.env.pollution / 100;
            this.ctx.fillStyle = `rgba(100, 0, 150, ${tox * 0.6})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.ctx.restore();

        if(this.isPlaying) {
            if(!this.isReviewing) {
                this.time += 0.05; 
                if(this.env.temp < 28 && this.env.pollution < 40 && Math.random() < 0.01) {
                    this.agents.push(new Agent('algae', Math.random()*this.canvas.width, Math.random()*this.canvas.height));
                }
                if(Math.floor(this.time) > Math.floor(this.time - 0.05)) { this.recordState(); }

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
                this.time += 0.05;
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

ui.init();
const sim = new Simulation();