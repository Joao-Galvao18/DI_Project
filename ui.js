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