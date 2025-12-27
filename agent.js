/* --- AGENT LOGIC (BALANCED - FASTER PACED) --- */
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
        
        this.angle = Math.atan2(this.vy, this.vx); 
        this.dead = false;
        this.subShapes = []; 

        this.coralTimer = 0;    
        this.coralCooldown = 0; 
        this.lastCoral = null; 
        this.currentCoral = null; 
        
        // Cooldowns adjusted for faster pace
        this.reproCooldown = 200 + Math.random() * 200;
        
        // --- VISUAL CONFIGURATION (SPEEDS INCREASED) ---
        if(type === 'fish') { 
            this.size = 12; 
            this.color = '#38bdf8'; 
            this.speed = 3.0; // Antes 2.0
            this.vision = 180; 
        }
        else if (type === 'shark') { 
            this.size = 22; 
            this.color = '#94a3b8'; 
            this.speed = 4.5; // Antes 3.2
            this.vision = 350; 
        }
        else if (type === 'shrimp') { 
            this.size = 6; 
            this.color = '#fb7185'; 
            this.speed = 1.8; // Antes 1.0
            this.vision = 120; 
        }
        else if (type === 'algae') { 
            this.size = 8; 
            this.color = '#4ade80'; 
            this.speed = 0; this.vx=0; this.vy=0; 
            for(let i=0; i<5; i++) {
                 this.subShapes.push({
                     ox: (Math.random() - 0.5) * this.size * 1.2, 
                     oy: (Math.random() - 0.5) * this.size * 1.2, 
                     r: this.size * (0.4 + Math.random() * 0.4)
                 });
            }
        }
        else if (type === 'coral') { 
            this.size = 18; 
            this.color = '#a78bfa'; 
            this.speed = 0; this.vx=0; this.vy=0; 
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
            this.color = '#1e293b'; 
            this.speed = 0; this.vx=0; this.vy=0; 
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
                const minDist = this.size + (other.size * 0.8); 
                
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

        // --- FASTER PACED LOGIC ---
        
        // POLLUTION EFFECT
        if(env.pollution > 20) {
            const damage = (env.pollution - 20) * 0.002; // Um pouco mais rápido que "slow", mas ainda gradual
            this.health -= damage;
        }

        // 1. FISH
        if(this.type === 'fish') {
            this.health -= 0.01; // Metabolismo moderado (precisa comer de vez em quando)
            
            const predator = this.findNearest(allAgents, 'shark');
            if (predator.agent && predator.dist < 150) {
                // Flee
                this.coralTimer = 0; this.currentCoral = null;
                const dx = this.x - predator.agent.x;
                const dy = this.y - predator.agent.y;
                this.vx += (dx / predator.dist) * 0.9; 
                this.vy += (dy / predator.dist) * 0.9;
            } 
            else if (this.health < 70) { 
                const food = this.findNearest(allAgents, 'shrimp');
                if (food.agent) {
                    const dx = food.agent.x - this.x;
                    const dy = food.agent.y - this.y;
                    this.vx += (dx / food.dist) * 0.2;
                    this.vy += (dy / food.dist) * 0.2;
                    if (food.dist < 20) { food.agent.dead = true; this.health = 100; }
                }
            }
            else {
                // Hiding logic
                if (this.coralCooldown <= 0) {
                    const coral = this.findNearest(allAgents, 'coral', this.lastCoral);
                    if (coral.agent && coral.dist < 120) {
                        const dx = coral.agent.x - this.x;
                        const dy = coral.agent.y - this.y;
                        this.vx += (dx / coral.dist) * 0.1;
                        this.vy += (dy / coral.dist) * 0.1;
                    }
                }
            }
        }
        
        // 2. ALGAE
        else if(this.type === 'algae') {
            if(env.temp > 30) this.health -= 0.1; 
            else if(env.temp < 28 && env.pollution < 40 && this.health < 100) this.health += 0.5;
        }
        
        // 3. SHRIMP
        else if(this.type === 'shrimp') {
            this.health -= 0.005; // Metabolismo baixo
            
            if(this.health < 75) { 
                const food = this.findNearest(allAgents, 'algae');
                if(food.agent) {
                    const dx = food.agent.x - this.x;
                    const dy = food.agent.y - this.y;
                    this.vx += (dx / food.dist) * 0.2;
                    this.vy += (dy / food.dist) * 0.2;
                    if(food.dist < 15) { food.agent.dead = true; this.health = 100; }
                }
            } else if(Math.random() < 0.05) {
                this.vx += (Math.random() - 0.5) * 1.5; this.vy += (Math.random() - 0.5) * 1.5;
            }
        }
        
        // 4. SHARK
        else if (this.type === 'shark') {
            this.health -= 0.04; // Gasta mais energia porque nada mais rápido
            
            if (this.health < 85) { 
                const prey = this.findNearest(allAgents, 'fish');
                if (prey.agent) {
                    const dx = prey.agent.x - this.x;
                    const dy = prey.agent.y - this.y;
                    this.vx += (dx / prey.dist) * 0.3; // Caça agressiva
                    this.vy += (dy / prey.dist) * 0.3;
                    
                    if (prey.dist < (this.size + prey.agent.size)) { 
                        prey.agent.dead = true;
                        this.health = Math.min(100, this.health + 35); 
                    }
                }
            }
        }

        // --- REPRODUCTION SYSTEM (Faster Cooldowns) ---
        if(this.reproCooldown > 0) {
            this.reproCooldown--;
        } 
        else if (['fish', 'shark', 'shrimp'].includes(this.type)) {
            
            let requiredHealth = 80;
            let cooldownReset = 0;
            let birthCost = 20;

            if(this.type === 'shark') {
                requiredHealth = 90;
                cooldownReset = 800; // Antes 2000
                birthCost = 25;
            } 
            else if (this.type === 'fish') {
                requiredHealth = 75;
                cooldownReset = 400; // Antes 1000
                birthCost = 15;
            }
            else if (this.type === 'shrimp') {
                requiredHealth = 70;
                cooldownReset = 250; // Antes 600
                birthCost = 10;
            }

            if (this.health >= requiredHealth) {
                const mateInfo = this.findNearest(allAgents, this.type);
                
                if (mateInfo.agent && mateInfo.dist < this.size * 3 && 
                    mateInfo.agent.health >= requiredHealth && 
                    mateInfo.agent.reproCooldown <= 0) {
                    
                    if(Math.random() < 0.05) { 
                        if(spawnCallback) spawnCallback(this.type, this.x, this.y);
                        
                        this.reproCooldown = cooldownReset; 
                        this.health -= birthCost; 
                        
                        mateInfo.agent.reproCooldown = cooldownReset;
                        mateInfo.agent.health -= birthCost;

                        this.vx *= -1; this.vy *= -1;
                    } 
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
        
        if (v > 0.1) this.angle = Math.atan2(this.vy, this.vx);

        if (this.x < this.size) { this.x = this.size; this.vx *= -1; }
        if (this.x > bounds.width - this.size) { this.x = bounds.width - this.size; this.vx *= -1; }
        if (this.y < this.size) { this.y = this.size; this.vy *= -1; }
        if (this.y > bounds.height - this.size) { this.y = bounds.height - this.size; this.vy *= -1; }
        
        if (this.health <= 0) this.dead = true;
    }

    draw(ctx, viewMode) {
        if(this.dead) return;

        if(viewMode === 'heatmap') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fillStyle = this.type === 'shark' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 100, 0.4)';
            ctx.fill();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = Math.max(0.3, this.health / 100); 
        
        if (this.type === 'algae') {
            ctx.fillStyle = this.color;
            this.subShapes.forEach(sub => {
                 ctx.beginPath();
                 ctx.arc(sub.ox, sub.oy, sub.r, 0, Math.PI*2);
                 ctx.fill();
            });
            ctx.beginPath();
            ctx.arc(0, 0, this.size*0.5, 0, Math.PI*2);
            ctx.fill();
        } 
        else if (this.type === 'coral') {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, this.size*0.6, 0, Math.PI*2);
            ctx.fill();
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
        else {
            ctx.rotate(this.angle);

            if (this.type === 'fish') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size/2, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(-this.size, 0);
                ctx.lineTo(-this.size - 8, -6);
                ctx.lineTo(-this.size - 8, 6);
                ctx.fill();
            }
            else if (this.type === 'shark') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size/2.5, 0, 0, Math.PI*2);
                ctx.fill();
                
                ctx.fillStyle = '#64748b';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-5, -this.size/2); 
                ctx.lineTo(5, 0);
                ctx.fill();
                ctx.fillStyle = this.color;

                ctx.beginPath();
                ctx.moveTo(this.size * 0.2, this.size/3);
                ctx.lineTo(-this.size * 0.2, this.size);
                ctx.lineTo(-this.size * 0.2, this.size/3);
                ctx.fill(); 
                
                ctx.beginPath();
                ctx.moveTo(this.size * 0.2, -this.size/3);
                ctx.lineTo(-this.size * 0.2, -this.size);
                ctx.lineTo(-this.size * 0.2, -this.size/3);
                ctx.fill(); 

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