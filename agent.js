/* --- AGENT LOGIC --- */
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