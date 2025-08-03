const WORLD_BOUNDS = {
    minX: 0,
    maxX: 19,
    minY: 0,
    maxY: 19,
};

class Renderer {
    constructor(dom, clientState, game) {
        this.dom = dom;
        this.clientState = clientState;
        this.game = game;
        this.buildingIcons = { 'Storage': '📦', 'Personal Storage': '🧰', 'Carpentry Workshop': '🪚', 'Smithing Workshop': '⚒️', 'Brewing Workshop': '⚗️', 'Kitchen': '🍳', 'Runecrafting Workshop': '🔮', 'Jewelry Workshop': '💎', 'Tailoring Workshop': '🧵', 'Enhancement Station': '✨' };
        this.tailwindColorMap = {
            'bg-gray-500': '#6b7280',
            'bg-red-500': '#ef4444',
            'bg-yellow-500': '#f59e0b',
            'bg-green-500': '#22c55e',
            'bg-blue-500': '#3b82f6',
            'bg-indigo-500': '#6366f1',
            'bg-purple-500': '#8b5cf6',
            'bg-pink-500': '#ec4899',
        };
    }

    getItemDisplayName(item) {
        return item.name;
    }

    getCraftingProgress(task) {
        if (!task.completionTime || !task.startTime) return 0;
        
        const now = Date.now();
        const elapsed = now - task.startTime;
        const total = task.completionTime - task.startTime;
        
        return Math.min(Math.max(elapsed / total, 0), 1);
    }

    getCraftingRemainingTime(task) {
        if (!task.completionTime) return 0;
        
        const now = Date.now();
        return Math.max(task.completionTime - now, 0);
    }

    renderAll(gameState, oldGameState) {
        if (this.clientState.showMapView) {
            this.renderMapView(gameState);
        } else {
            this.renderAreaView(gameState, oldGameState);
            
            const player = gameState.player;
            const oldPlayer = oldGameState ? oldGameState.player : null;

            if (!oldPlayer) {
                this.renderCharacterPanel(gameState);
                return;
            }

            // A full re-render is needed if death status changes
            if (player.isDead !== oldPlayer.isDead) {
                this.renderCharacterPanel(gameState);
                return;
            }

            // Selectively update parts of the character panel
            if (JSON.stringify(player.stats) !== JSON.stringify(oldPlayer.stats)) {
                const statsContainer = document.getElementById('player-stats-container');
                if (statsContainer) statsContainer.innerHTML = this.renderPlayerStats(player);
            }
            if (JSON.stringify(player.equipment) !== JSON.stringify(oldPlayer.equipment)) {
                const equipmentContainer = document.getElementById('equipment-container');
                if (equipmentContainer) equipmentContainer.innerHTML = this.renderEquipment(player);
            }
            if (JSON.stringify(player.inventory) !== JSON.stringify(oldPlayer.inventory)) {
                const inventoryContainer = document.getElementById('inventory-container');
                if (inventoryContainer) inventoryContainer.innerHTML = this.renderInventory(player);
            }
            if (JSON.stringify(player.skills) !== JSON.stringify(oldPlayer.skills)) {
                const skillsContainer = document.getElementById('skills-container');
                if (skillsContainer) skillsContainer.innerHTML = this.renderSkills(player);
            }
        }
    }

    updateCharacterView(player) {
        const characterContainer = document.getElementById('character-panel-full');
        if (characterContainer) {
            characterContainer.innerHTML = this.renderCharacter(player);
        }
    }

    renderCharacter(player) {
        return `
            <div id="player-stats-container" class="mb-6">
                ${this.renderPlayerStats(player)}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-lg font-semibold text-yellow-400 mb-3">⚔️ Equipment</h3>
                    <div id="equipment-container">${this.renderEquipment(player)}</div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-yellow-400 mb-3">🎒 Inventory</h3>
                    <div id="inventory-container" class="space-y-2 custom-scrollbar pr-2" style="max-height: 250px; overflow-y: auto;">${this.renderInventory(player)}</div>
                </div>
            </div>
             <div class="mt-6">
                <h3 class="text-lg font-semibold text-yellow-400 mb-3">🌟 Skills</h3>
                <div id="skills-container" class="space-y-4">${this.renderSkills(player)}</div>
            </div>
        `;
    }

    renderPlayerStats(player) {
      if (!player) return '';

      const stats = player.stats || {};
      const safeStats = {
          hp: stats.hp || 0,
          maxHp: stats.maxHp || 1,
          mp: stats.mp || 0,
          maxMp: stats.maxMp || 1,
          stamina: stats.stamina || 0,
          maxStamina: stats.maxStamina || 1,
          dmg: stats.dmg || 0,
          speed: stats.speed || 0,
          critical: stats.critical || 0,
          dodge: stats.dodge || 0,
          accuracy: stats.accuracy || 0,
          def: stats.def || 0,
      };

      const gridStats = `
          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-4">
              ${this.createStatDisplay('⚔️', 'Damage', safeStats.dmg.toFixed(1))}
              ${this.createStatDisplay('🏃', 'Speed', safeStats.speed.toFixed(1))}
              ${this.createStatDisplay('🎯', 'Critical', `${safeStats.critical.toFixed(1)}%`)}
              ${this.createStatDisplay('💨', 'Dodge', `${safeStats.dodge.toFixed(1)}%`)}
              ${this.createStatDisplay('👁️', 'Accuracy', `${safeStats.accuracy.toFixed(1)}%`)}
              ${this.createStatDisplay('🛡️', 'Defense', safeStats.def.toFixed(1))}
          </div>`;

      const statBars = `
          <div class="space-y-3 mt-4">
              ${this.createBar(safeStats.hp, safeStats.maxHp, 'hp', `❤️ HP: ${safeStats.hp.toFixed(0)}/${safeStats.maxHp.toFixed(0)}`).outerHTML}
              ${this.createBar(safeStats.mp, safeStats.maxMp, 'mp', `💧 MP: ${safeStats.mp.toFixed(0)}/${safeStats.maxMp.toFixed(0)}`).outerHTML}
              ${this.createBar(safeStats.stamina, safeStats.maxStamina, 'stamina', `⚡ Stamina: ${safeStats.stamina.toFixed(0)}/${safeStats.maxStamina.toFixed(0)}`).outerHTML}
          </div>`;
      
      return `${statBars}${gridStats}`;
    }

    renderInventory(player, isModal = false) {
        const inventory = player.inventory || [];
        if (inventory.length === 0) {
            return '<p class="text-slate-500 italic">Inventory is empty.</p>';
        }
        return inventory.map((item, index) => {
            let actionButton = '';
            if (!isModal) {
                if (item.type === 'equipment') actionButton = `<button class="text-xs bg-green-600 text-white px-2 py-1 rounded" data-action="equip-item" data-item-index="${index}">Equip</button>`;
                else if (item.type === 'consumable' || item.type === 'scroll') actionButton = `<button class="text-xs bg-sky-600 text-white px-2 py-1 rounded" data-action="use-item" data-item-index="${index}">Use</button>`;
            }
            
            let depositButtons = '';
            if (!isModal && this.game && this.game.gameState && this.game.gameState.cell) {
                const site = this.game.gameState.cell.objects.find(o => o.type === 'construction_site' && o.team === player.team);
                if (site && site.buildings) {
                    site.buildings.forEach((building, buildingIndex) => {
                        if (building.type === 'storage' || building.type === 'personal_storage') {
                            const storageType = building.type;
                            depositButtons += `<button class="text-xs bg-yellow-600 text-white px-1 py-0.5 rounded ml-1" data-action="deposit-storage" data-building-index="${buildingIndex}" data-item-index="${index}" data-storage-type="${storageType}">${storageType === 'storage' ? 'Team' : 'Personal'}</button>`;
                        }
                    });
                }
            }
            
            const enhancementText = item.enhancementSlots > 0 ? `[${(item.enchantments || []).length}/${item.enhancementSlots}]` : '';
            return `<div class="p-2 bg-slate-800/50 border border-slate-600 rounded-md flex justify-between items-center" title="${item.description}"><span class="item-name-clickable cursor-pointer hover:text-blue-300 transition-colors" data-item-index="${index}" data-item-type="inventory">${this.getItemDisplayName(item)} ${item.quantity ? `(x${item.quantity})` : ''} ${enhancementText}</span><div class="flex gap-1">${actionButton}${depositButtons}</div></div>`;
        }).join('');
    }

    renderEquipment(player, isModal = false) {
        const equipment = player.equipment || {};
        const slots = ['weapon', 'helmet', 'armor', 'legs', 'gloves', 'boots', 'cape', 'ring1', 'ring2', 'ring3'];

        const renderSlot = (slot) => {
            const item = equipment[slot];
            const displayName = slot.startsWith('ring') ? `Ring ${slot.charAt(4)}` : slot.charAt(0).toUpperCase() + slot.slice(1);
            
            return `
                <div class="bg-slate-800/50 p-2 rounded-md border border-slate-700">
                    <div class="capitalize font-semibold text-slate-400 text-xs mb-1">${displayName}</div>
                    ${item ? `
                        <div class="bg-slate-900 p-1.5 rounded-md border border-blue-600/50" title="${item.description || ''}">
                            <div class="text-blue-300 item-name-clickable cursor-pointer hover:text-blue-100 transition-colors text-xs" data-item-slot="${slot}" data-item-type="equipment">
                                ${this.getItemDisplayName(item)}
                            </div>
                            ${!isModal ? `
                                <button class="mt-1 w-full text-xs bg-red-600 text-white px-2 py-0.5 rounded" data-action="unequip-item" data-slot="${slot}">Unequip</button>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="p-1 text-center text-slate-500 italic text-xs h-[42px] flex items-center justify-center">Empty</div>
                    `}
                </div>
            `;
        };
        
        return `<div class="grid grid-cols-2 gap-2">${slots.map(renderSlot).join('')}</div>`;
    }

    renderSkills(player) {
        const skills = player.skills || {};
        return Object.entries(skills).map(([skillName, skillData]) => `<div><div class="flex justify-between items-center"><span class="capitalize font-semibold">${skillName} (Lvl ${skillData.level})</span></div>${this.createBar(skillData.exp, skillData.level * 100, 'xp').outerHTML}</div>`).join('');
    }

    renderAreaView(gameState, oldGameState) {
        const grid = this.dom.mainViewContent;
        const activePlayer = gameState.player;
        const cellData = gameState.cell;

        if (!activePlayer || !cellData) {
            grid.innerHTML = `<div class="w-full h-full flex items-center justify-center text-center p-8 text-slate-400">Waiting for game state...</div>`;
            return;
        }

        const oldCellData = oldGameState ? oldGameState.cell : null;
        const entitiesMap = new Map((oldCellData ? [...oldCellData.players, ...oldCellData.objects] : []).map(e => [e.id, e]));

        // If the fundamental structure of the cell has changed, do a full re-render
        if (!oldCellData || cellData.players.length !== oldCellData.players.length || cellData.objects.length !== oldCellData.objects.length) {
            this.fullRenderAreaView(gameState);
            return;
        }
        
        // --- If structure is the same, do a partial update ---
        const allEntities = [...cellData.players, ...cellData.objects];
        allEntities.forEach(entity => {
            const oldEntity = entitiesMap.get(entity.id);
            if (!oldEntity || JSON.stringify(entity.stats) !== JSON.stringify(oldEntity.stats)) {
                const card = grid.querySelector(`[data-entity-id="${entity.id}"]`);
                if (card) {
                    const currentHp = entity.stats?.hp || 0;
                    const maxHp = entity.stats?.maxHp || 1;
                    const hpBar = card.querySelector('.hp-bar-foreground');
                    const hpText = card.querySelector('.entity-hp-text');

                    if (hpBar) hpBar.style.width = `${(currentHp / maxHp) * 100}%`;
                    if (hpText) hpText.textContent = `${currentHp.toFixed(0)}/${maxHp.toFixed(0)}`;
                }
            }
        });
    }

    fullRenderAreaView(gameState) {
        const grid = this.dom.mainViewContent;
        grid.innerHTML = '';
        const activePlayer = gameState.player;
        const cellData = gameState.cell;

        if (!activePlayer || !cellData) {
            grid.innerHTML = `<div class="w-full h-full flex items-center justify-center text-center p-8 text-slate-400">Waiting for game state...</div>`;
            return;
        }
        
        // Get biome information
        let biomeName = 'Unknown';
        let biomeColor = 'text-gray-400';
        if (gameState.biomeMap) {
            const biomeKey = gameState.biomeMap[`${cellData.x},${cellData.y}`];
            const biome = CONFIG.BIOMES[biomeKey];
            if (biome) {
                biomeName = biome.name;
                biomeColor = biome.textColor;
            }
        }
        
        this.dom.mainViewTitle.innerHTML = `🗺️ Area View (${cellData.x}, ${cellData.y}) - <span class="${biomeColor}">${biomeName}</span>`;

        grid.className = 'area-container flex-1 bg-slate-800/50 p-2 md:p-4 rounded-lg shadow-inner flex flex-col gap-2 md:gap-4 items-start content-start overflow-y-auto custom-scrollbar';
        const site = cellData.objects.find(o => o.type === 'construction_site');
        const mobs = cellData.objects.filter(o => o.type === 'mob');
        const siegeMachines = cellData.objects.filter(o => o.type === 'siege');
        
        const otherPlayers = cellData.players.filter(p => p.id !== activePlayer.id);
        const playersInside = site ? otherPlayers.filter(p => p.isInsideCastle) : [];
        const playersOutside = site ? otherPlayers.filter(p => !p.isInsideCastle) : otherPlayers;
        if (site && activePlayer.isInsideCastle) {
            playersInside.push(activePlayer);
        } else {
            playersOutside.push(activePlayer);
        }
        
        // Render Outside section (players) if castle exists
        if (site) {
            const outsideSection = document.createElement('div');
            outsideSection.className = 'w-full';
            
            const outsideContainer = document.createElement('div');
            outsideContainer.className = 'bg-slate-900/30 p-3 rounded-lg border border-slate-600 mb-4';
            outsideContainer.innerHTML = `<h4 class="font-bold text-lg text-slate-300 mb-3">🌍 Outside Castle</h4>`;
            
            const outsideGrid = document.createElement('div');
            outsideGrid.className = 'grid grid-cols-6 gap-1 md:gap-2';

            if (playersOutside.length > 0) {
                playersOutside.forEach((player) => {
                    const card = this.createPlayerCard(player, gameState, activePlayer);
                    outsideGrid.appendChild(card);
                });
            } else {
                 outsideGrid.innerHTML = '<div class="text-slate-400 italic col-span-6">No players outside.</div>';
            }
            
            outsideContainer.appendChild(outsideGrid);
            outsideSection.appendChild(outsideContainer);
            grid.appendChild(outsideSection);
        }

        if (site) {
            const siteTeam = gameState.teams[site.team];
            const siteCard = document.createElement('div');
            siteCard.className = 'w-full';
            const teamColorName = siteTeam ? siteTeam.color : '#808080';
            let siteActionsHtml = '';
            if (activePlayer.team === site.team) {
                // Only castle team members can go inside/outside
                if (activePlayer.isInsideCastle) {
                    siteActionsHtml = `<button data-action="donate" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 shadow-md transition-colors w-full sm:w-auto">Donate Bricks</button><button data-action="go-outside" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 shadow-md transition-colors w-full sm:w-auto ml-2">🌍 Go Outside</button>`;
                } else {
                    siteActionsHtml = `<button data-action="donate" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 shadow-md transition-colors w-full sm:w-auto">Donate Bricks</button><button data-action="go-inside" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 shadow-md transition-colors w-full sm:w-auto ml-2">🏰 Go Inside</button>`;
                }
            } else if (activePlayer.team && activePlayer.team !== gameState.noobsTeamId) {
                // Enemy team - can only attack, cannot enter
                siteActionsHtml = `<button data-action="attack" data-target-id="${site.id}" class="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 shadow-md transition-colors w-full sm:w-auto">Attack Castle</button><button data-action="deploySiege" class="bg-red-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-800 shadow-md transition-colors w-full sm:w-auto ml-2">Deploy Siege</button>`;
            } else {
                // Neutral player (noobs team) - no interaction with castle
                siteActionsHtml = ``;
            }
            let upgradeHtml = '';
            const completeUntil = site.constructionCompleteUntil || 0;
            if (completeUntil > Date.now()) {
                const remainingS = Math.max(0, Math.ceil((completeUntil - Date.now()) / 1000));
                upgradeHtml = `<div class="text-xs text-amber-300 italic mt-2">Upgrading... (${remainingS}s remaining)</div>`;
            }
            let buildingsHtml = '';
            if (site.buildings && site.buildings.length > 0) {
                 buildingsHtml += '<div class="mt-3 pt-3 border-t border-slate-700"><h5 class="font-semibold text-yellow-400 text-sm mb-2">Buildings:</h5><div class="flex flex-wrap gap-2">';
                 site.buildings.forEach((b, index) => {
                       buildingsHtml += this.renderBuildingCard(b, index, activePlayer, gameState);
                 });
                 buildingsHtml += '</div></div>';
            }
             if (activePlayer.team === site.team) {
                  buildingsHtml += `<button data-action="open-build-modal" class="mt-2 w-full bg-amber-600 text-white font-semibold py-1 rounded hover:bg-amber-700 text-sm">Construct Building</button>`;
             }
            let siegeMachinesHtml = '';
            if (siegeMachines.length > 0) {
                siegeMachinesHtml += '<div class="mt-3 pt-3 border-t border-slate-700"><h5 class="font-semibold text-yellow-400 text-sm mb-2">Deployed Siege Engines:</h5><div class="grid grid-cols-10 gap-2">';
                siegeMachines.forEach(machine => {
                    const machineTeamColor = gameState.teams[machine.team] ? this.tailwindColorMap[gameState.teams[machine.team].color] || '#808080' : '#808080';
                    const safeHp = machine.stats?.hp || 0;
                    const safeMaxHp = machine.stats?.maxHp || 1;
                    siegeMachinesHtml += `<div class="bg-slate-800/60 p-2 rounded-md relative" title="${machine.id}"><div class="flex justify-between items-center text-xs"><span class="font-bold" style="color: ${machineTeamColor};">💣</span><span class="text-slate-300">${safeHp.toFixed(0)}</span></div>${this.createBar(safeHp, safeMaxHp, 'hp').outerHTML}</div>`;
                });
                siegeMachinesHtml += '</div></div>';
            }
            const safeSiteHp = site.stats?.hp || 0;
            const safeSiteMaxHp = site.stats?.maxHp || 1;
            siteCard.innerHTML = `<div class="bg-slate-900/50 p-4 rounded-lg flex flex-col sm:flex-row items-start gap-4" style="border: 1px solid ${this.tailwindColorMap[teamColorName] || teamColorName};"><div class="flex-1 w-full"><h4 class="font-bold text-lg" style="color: ${this.tailwindColorMap[teamColorName] || teamColorName};">🏰 ${site.id} (Lvl ${site.level})</h4><div class="text-sm">HP: ${safeSiteHp.toFixed(0)} / ${safeSiteMaxHp.toFixed(0)}</div>${this.createBar(safeSiteHp, safeSiteMaxHp, 'hp').outerHTML}<div class="text-sm mt-2">Bricks: ${site.materials.bricks} / ${site.requiredMaterials.bricks}</div>${this.createBar(site.materials.bricks, site.requiredMaterials.bricks, 'brick').outerHTML}${upgradeHtml}${buildingsHtml}${siegeMachinesHtml}</div><div class="flex-shrink-0 mt-2 sm:mt-0">${siteActionsHtml}</div></div>`;
            
            grid.appendChild(siteCard);
        } else if (activePlayer.team && activePlayer.team !== gameState.noobsTeamId) {
            const buildCard = document.createElement('div');
            buildCard.className = 'w-full';
            buildCard.innerHTML = `<div class="bg-slate-900/50 p-4 rounded-lg border border-slate-600 flex items-center justify-center"><button data-action="build" class="bg-amber-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-amber-700 shadow-md transition-colors">Build Construction Site</button></div>`;
            grid.appendChild(buildCard);
        }
        // --- Render Inside Castle Section (Players and Mobs) ---
        if (site && (playersInside.length > 0 || mobs.length > 0)) {
            const insideSection = document.createElement('div');
            insideSection.className = 'w-full inside-castle-section';
            insideSection.innerHTML = `<div class="bg-slate-900/30 p-3 rounded-lg border border-slate-600 mb-4">
                <h4 class="font-bold text-lg text-slate-300 mb-3">🏰 Inside Castle</h4>
                <div id="inside-castle-content" class="space-y-4"></div>
            </div>`;
            const insideContent = insideSection.querySelector('#inside-castle-content');

            // Render mobs inside
            if (mobs.length > 0) {
                const mobsContainer = document.createElement('div');
                mobsContainer.innerHTML = '<h5 class="font-semibold text-base text-slate-300 mb-2">Enemies</h5>';
                const mobsGrid = document.createElement('div');
                mobsGrid.className = 'grid grid-cols-6 gap-1 md:gap-2';
                
                mobs.forEach(mob => {
                    mobsGrid.appendChild(this.createMobCard(mob, activePlayer, site));
                });
                
                mobsContainer.appendChild(mobsGrid);
                insideContent.appendChild(mobsContainer);
            }

            // Render players inside
            if (playersInside.length > 0) {
                const playersContainer = document.createElement('div');
                playersContainer.innerHTML = '<h5 class="font-semibold text-base text-slate-300 mb-2">Players</h5>';
                const playersGrid = document.createElement('div');
                playersGrid.className = 'grid grid-cols-6 gap-1 md:gap-2';
                
                playersInside.forEach((player) => {
                    const card = this.createPlayerCard(player, gameState, activePlayer);
                    playersGrid.appendChild(card);
                });
                
                playersContainer.appendChild(playersGrid);
                insideContent.appendChild(playersContainer);
            }


            grid.appendChild(insideSection);
        }

        // Render Mobs when NO castle exists
        if (!site && mobs.length > 0) {
            const mobsContainer = document.createElement('div');
            mobsContainer.className = 'w-full grid grid-cols-6 gap-1 md:gap-2';
            mobs.forEach(mob => mobsContainer.appendChild(this.createMobCard(mob, activePlayer, null)));
            grid.appendChild(mobsContainer);
        }
        
        // Render all players as one section if no castle exists
        if (!site && playersOutside.length > 0) {
            const playersContainer = document.createElement('div');
            playersContainer.className = 'w-full grid grid-cols-6 gap-1 md:gap-2';
            playersOutside.forEach((player) => {
                const card = this.createPlayerCard(player, gameState, activePlayer);
                playersContainer.appendChild(card);
            });
            grid.appendChild(playersContainer);
        }

        const canBuild = activePlayer.team && activePlayer.team !== gameState.noobsTeamId;
        if (!site && mobs.length === 0 && !canBuild) {
            const peacefulDiv = document.createElement('div');
            peacefulDiv.className = 'w-full h-full flex items-center justify-center text-center p-8 text-slate-400';
            peacefulDiv.textContent = 'This area is peaceful.';
            grid.appendChild(peacefulDiv);
        }
    }

    renderBuildingCard(building, index, player, gameState) {
        let preview = '';
        let itemCount = 0;
        
        switch (building.type) {
            case 'storage':
                // Basic preview for team storage
                if (building.inventory && building.inventory.length > 0) {
                    itemCount = building.inventory.reduce((total, item) => total + (item.quantity || 1), 0);
                    preview = `<div class="mt-1 text-xs text-slate-300">${itemCount} items stored</div>`;
                } else {
                    preview = `<div class="mt-1 text-xs text-slate-400">Empty</div>`;
                }
                break;
            case 'personal_storage':
                // Basic preview for personal storage
                const playerStorage = building.playerInventories && building.playerInventories[player.id];
                if (playerStorage && playerStorage.length > 0) {
                    itemCount = playerStorage.reduce((total, item) => total + (item.quantity || 1), 0);
                    preview = `<div class="mt-1 text-xs text-slate-300">${itemCount} items stored</div>`;
                } else {
                    preview = `<div class="mt-1 text-xs text-slate-400">Empty</div>`;
                }
                break;
            case 'crafting':
                // Basic preview for crafting
                const queueCount = building.craftingQueue ? building.craftingQueue.length : 0;
                if (queueCount > 0) {
                    const currentTask = building.craftingQueue[0];
                    const progress = this.getCraftingProgress(currentTask);
                    const remainingTime = this.getCraftingRemainingTime(currentTask);
                    const progressBar = `<div class="w-full bg-slate-700 rounded-full h-1 mb-1">
                        <div class="bg-green-500 h-1 rounded-full" style="width: ${progress * 100}%"></div>
                    </div>`;
                    const timeText = remainingTime > 0 ? `${Math.ceil(remainingTime / 1000)}s` : 'Completing...';
                    preview = `<div class="mt-1 text-xs">
                        ${progressBar}
                        <div class="text-slate-300">${queueCount} task${queueCount > 1 ? 's' : ''} in queue - ${timeText}</div>
                    </div>`;
                } else {
                    preview = `<div class="mt-1 text-xs text-slate-400">Idle</div>`;
                }
                break;
        }
        
        return `<div class="bg-slate-800/60 p-2 rounded-md flex-grow cursor-pointer hover:bg-slate-700/60 transition-colors" 
                    data-action="open-building" 
                    data-building-index="${index}" 
                    title="Click to open ${building.name}">
                    <span class="text-xl">${this.buildingIcons[building.name] || '🏛️'}</span>
                    <div class="text-xs">${building.name} (L${building.level})</div>
                    ${preview}
                </div>`;
    }

    renderBuildingModal(building, buildingIndex, player, gameState) {
        const modalTitle = document.getElementById('building-modal-title');
        const modalContent = document.getElementById('building-modal-content');
        
        modalTitle.innerHTML = `${this.buildingIcons[building.name] || '🏛️'} ${building.name} (Level ${building.level})`;
        
        let content = '';
        
        let storageStatus = '';
        if (building.type === 'storage' || building.type === 'personal_storage') {
            const items = (building.type === 'personal_storage') 
                ? (building.playerInventories && building.playerInventories[player.id] ? building.playerInventories[player.id] : [])
                : (building.inventory || []);
            
            const itemCount = items.length;
            const maxSlots = building.slots || 0;
            const usagePercent = maxSlots > 0 ? (itemCount / maxSlots) * 100 : 0;

            storageStatus = `<div class="mb-4">
                <div class="flex justify-between items-center text-sm text-slate-300 mb-1">
                    <span>Storage Usage</span>
                    <span>${itemCount} / ${maxSlots} slots</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2.5">
                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${usagePercent}%"></div>
                </div>
            </div>`;
        }

        content += storageStatus;
        
        // --- Upgrade Section ---
        if (building.upgradeRequirements) {
            content += `<div class="bg-slate-700/30 p-4 rounded-md border border-slate-600 mb-6">
                <h4 class="text-lg font-semibold text-yellow-400 mb-3">Upgrade to Level ${building.level + 1}</h4>
                <div class="space-y-2">`;
            
            building.upgradeRequirements.materials.forEach(mat => {
                const donated = building.donations[mat.name] || 0;
                const progress = (donated / mat.quantity) * 100;
                content += `<div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-slate-300">${mat.name}</span>
                                    <span class="font-semibold ${donated >= mat.quantity ? 'text-green-400' : 'text-slate-400'}">
                                        ${donated} / ${mat.quantity}
                                    </span>
                                </div>
                                <div class="w-full bg-slate-800 rounded-full h-2.5">
                                    <div class="bg-green-600 h-2.5 rounded-full" style="width: ${progress}%"></div>
                                </div>
                            </div>`;
            });

            content += `</div>
                <div class="mt-4 pt-4 border-t border-slate-600">
                    <h5 class="text-md font-semibold text-white mb-2">Donate from your Inventory:</h5>
                    <div class="max-h-48 overflow-y-auto space-y-2 pr-2">`;
            
            const relevantInventory = player.inventory.filter(item => 
                building.upgradeRequirements.materials.some(req => req.name === item.name)
            );

            if (relevantInventory.length > 0) {
                relevantInventory.forEach((item, invIndex) => {
                    // Find original index to pass to server
                    const originalIndex = player.inventory.findIndex(invItem => invItem === item);
                    const maxQuantity = item.quantity || 1;
                    content += `<div class="flex justify-between items-center p-2 bg-slate-900/50 rounded">
                                    <span>${item.name} (x${maxQuantity})</span>
                                    <div class="flex items-center gap-1">
                                        <input type="number" id="donate-qty-${originalIndex}" min="1" max="${maxQuantity}" value="1" class="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
                                        <button data-action="donate-to-building" 
                                                data-building-index="${buildingIndex}" 
                                                data-item-index="${originalIndex}" 
                                                onclick="this.dataset.quantity = document.getElementById('donate-qty-${originalIndex}').value"
                                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">
                                            Donate
                                        </button>
                                    </div>
                                </div>`;
                });
            } else {
                content += `<p class="text-slate-400 italic">You don't have the required materials.</p>`;
            }

            content += `</div></div></div>`;
        } else {
            content += `<div class="bg-slate-700/30 p-4 rounded-md border border-slate-600 mb-6">
                <h4 class="text-lg font-semibold text-green-400">Max Level Reached</h4>
            </div>`;
        }


        // --- Building-specific Content ---
        switch (building.type) {
            case 'storage':
                content += this.renderStorageModal(building, buildingIndex, player, gameState, 'Team Storage');
                break;
            case 'personal_storage':
                content += this.renderStorageModal(building, buildingIndex, player, gameState, 'Personal Storage');
                break;
            case 'crafting':
                content += this.renderCraftingModal(building, buildingIndex, player, gameState);
                break;
            default:
                content += `<div class="text-slate-400">No detailed view available for this building type.</div>`;
        }
        
        modalContent.innerHTML = content;
    }

    renderStorageModal(building, buildingIndex, player, gameState, storageType) {
        let items = [];
        let isPersonal = storageType === 'Personal Storage';
        
        if (isPersonal) {
            items = building.playerInventories && building.playerInventories[player.id] ? building.playerInventories[player.id] : [];
        } else {
            items = building.inventory || [];
        }
        
        let storedItemsHtml = '';
        if (items.length > 0) {
            storedItemsHtml = items.map((item, itemIndex) => {
                const itemDisplay = this.getItemDisplayName(item);
                const quantityText = item.quantity ? ` (x${item.quantity})` : '';
                return `<div class="flex justify-between items-center p-3 bg-slate-700/50 rounded-md border border-slate-600">
                    <div class="flex items-center gap-3">
                        <span class="text-lg item-name-clickable cursor-pointer hover:text-blue-300 transition-colors" data-item-index="${itemIndex}" data-item-type="storage" data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" data-building-index="${buildingIndex}">${itemDisplay}</span>
                        <span class="text-slate-400">${quantityText}</span>
                    </div>
                    <button data-action="withdraw-storage" 
                            data-building-index="${buildingIndex}" 
                            data-item-index="${itemIndex}" 
                            data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                        Withdraw
                    </button>
                </div>`;
            }).join('');
        } else {
            storedItemsHtml = `<div class="text-center text-slate-400 py-8">No items stored</div>`;
        }

        // Player inventory for depositing
        let playerInventoryHtml = '';
        if (player.inventory && player.inventory.length > 0) {
            playerInventoryHtml = player.inventory.map((item, itemIndex) => {
                const itemDisplay = this.getItemDisplayName(item);
                const quantityText = item.quantity ? ` (x${item.quantity})` : '';
                const maxQuantity = item.quantity || 1;
                
                let depositButtons = '';
                if (maxQuantity === 1) {
                    depositButtons = `<button data-action="deposit-storage" 
                            data-building-index="${buildingIndex}" 
                            data-item-index="${itemIndex}" 
                            data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" 
                            data-quantity="1"
                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                        Deposit
                    </button>`;
                } else {
                    depositButtons = `<div class="flex gap-1">
                        <button data-action="deposit-storage" 
                                data-building-index="${buildingIndex}" 
                                data-item-index="${itemIndex}" 
                                data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" 
                                data-quantity="1"
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">
                            1
                        </button>
                        <button data-action="deposit-storage" 
                                data-building-index="${buildingIndex}" 
                                data-item-index="${itemIndex}" 
                                data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" 
                                data-quantity="5"
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">
                            5
                        </button>
                        <button data-action="deposit-storage" 
                                data-building-index="${buildingIndex}" 
                                data-item-index="${itemIndex}" 
                                data-storage-type="${isPersonal ? 'personal_storage' : 'storage'}" 
                                data-quantity="${maxQuantity}"
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">
                            All
                        </button>
                    </div>`;
                }
                
                return `<div class="flex justify-between items-center p-3 bg-slate-700/50 rounded-md border border-slate-600">
                    <div class="flex items-center gap-3">
                        <span class="text-lg item-name-clickable cursor-pointer hover:text-blue-300 transition-colors" data-item-index="${itemIndex}" data-item-type="inventory">${itemDisplay}</span>
                        <span class="text-slate-400">${quantityText}</span>
                    </div>
                    ${depositButtons}
                </div>`;
            }).join('');
        } else {
            playerInventoryHtml = `<div class="text-center text-slate-400 py-8">Your inventory is empty</div>`;
        }
        
        return `
            <div class="space-y-6">
                <div class="bg-slate-700/30 p-4 rounded-md border border-slate-600">
                    <h4 class="text-lg font-semibold text-yellow-400 mb-2">${storageType}</h4>
                    <p class="text-slate-300 text-sm">${isPersonal ? 'Your personal storage space. Only you can access these items.' : 'Team storage space. All team members can access these items.'}</p>
                </div>
                
                <div class="space-y-4">
                    <h5 class="text-lg font-semibold text-white">Your Inventory - Deposit Items</h5>
                    <div class="max-h-64 overflow-y-auto space-y-2">
                        ${playerInventoryHtml}
                    </div>
                </div>
                
                <div class="space-y-4">
                    <h5 class="text-lg font-semibold text-white">Stored Items (${items.length})</h5>
                    <div class="max-h-64 overflow-y-auto space-y-2">
                        ${storedItemsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderCraftingModal(building, buildingIndex, player, gameState) {
        const availableRecipes = gameState.craftingRecipes.filter(recipe => 
            building.recipeIds && building.recipeIds.includes(recipe.id)
        );
        
        let queueHtml = '';
        if (building.craftingQueue && building.craftingQueue.length > 0) {
            queueHtml = building.craftingQueue.map((task, queueIndex) => {
                const progress = this.getCraftingProgress(task);
                const remainingTime = this.getCraftingRemainingTime(task);
                const progressBar = `<div class="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: ${progress * 100}%"></div>
                </div>`;
                const status = task.completed ? 'Completed' : `${Math.ceil(remainingTime / 1000)}s remaining`;
                const statusClass = task.completed ? 'text-green-400' : 'text-yellow-400';
                
                return `<div class="bg-slate-700/50 p-3 rounded-md border border-slate-600">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold text-white">${task.recipeName}</span>
                        <span class="text-sm text-slate-400">by ${task.playerName}</span>
                    </div>
                    ${progressBar}
                    <div class="text-sm ${statusClass}">${status}</div>
                </div>`;
            }).join('');
        } else {
            queueHtml = `<div class="text-center text-slate-400 py-4">No tasks in queue</div>`;
        }
        
        let recipesHtml = '';
        if (availableRecipes.length > 0) {
            recipesHtml = availableRecipes.map(recipe => {
                const canCraft = recipe.materials.every(material => {
                    const playerItem = player.inventory.find(item => item.name === material.name);
                    return playerItem && playerItem.quantity >= material.quantity;
                });
                const buttonClass = canCraft ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 cursor-not-allowed';
                const buttonDisabled = canCraft ? '' : 'disabled';
                const materialsText = recipe.materials.map(m => `${m.quantity}x ${m.name}`).join(', ');
                const timeText = `${Math.ceil(recipe.craftingTime / 1000)}s`;
                
                return `<div class="bg-slate-700/50 p-3 rounded-md border border-slate-600">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold text-white">${recipe.name}</span>
                        <span class="text-sm text-slate-400">${timeText}</span>
                    </div>
                    <div class="text-sm text-slate-300 mb-3">Materials: ${materialsText}</div>
                    <button data-action="craft-item" 
                            data-building-index="${buildingIndex}" 
                            data-recipe-id="${recipe.id}" 
                            ${buttonDisabled} 
                            class="w-full text-sm text-white px-3 py-2 rounded ${buttonClass} transition-colors">
                        ${canCraft ? 'Start Crafting' : 'Missing Materials'}
                    </button>
                </div>`;
            }).join('');
        }
        
        const queueCount = building.craftingQueue ? building.craftingQueue.length : 0;
        const maxSlots = building.slots || 0;
        
        return `
            <div class="space-y-6">
                <div class="bg-slate-700/30 p-4 rounded-md border border-slate-600">
                    <div class="flex justify-between items-center">
                        <h4 class="text-lg font-semibold text-yellow-400 mb-2">Crafting Workshop</h4>
                        <span class="text-sm text-slate-300">${queueCount} / ${maxSlots} slots</span>
                    </div>
                    <p class="text-slate-300 text-sm">Craft items using materials from your inventory. Only one task can be processed at a time.</p>
                </div>
                
                <div class="space-y-4">
                    <h5 class="text-lg font-semibold text-white">Crafting Queue (${queueCount})</h5>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        ${queueHtml}
                    </div>
                </div>
                
                <div class="space-y-4">
                    <h5 class="text-lg font-semibold text-white">Available Recipes (${availableRecipes.length})</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${recipesHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderEnhancementModal(building, buildingIndex, player, selectedItemIndex = null) {
        const modalContent = document.getElementById('enhancement-modal-content');
        
        // Get enchantable equipment, remembering their original inventory index
        const enchantableEquipment = player.inventory
            .map((item, index) => ({ item, originalIndex: index })) // Keep original item and index
            .filter(({ item }) => 
                item.type === 'equipment' && 
                item.enhancementSlots > 0 && 
                (!item.enchantments || item.enchantments.length < item.enhancementSlots)
            );

        // Get runes, also remembering their original index
        const availableRunes = player.inventory
            .map((item, index) => ({ item, originalIndex: index }))
            .filter(({ item }) => item.type === 'rune');

        // Build the list of equipment to display
        let equipmentHtml = enchantableEquipment.map(({ item, originalIndex }) => {
            const isSelected = originalIndex === selectedItemIndex;
            const selectedClass = isSelected ? 'border-yellow-400 bg-slate-600' : 'border-slate-600';
            const enchantments = item.enchantments || [];
            const displayName = this.getItemDisplayName(item);
            
            return `
            <div class="p-2 bg-slate-700/50 rounded-md border ${selectedClass} flex justify-between items-center transition-all">
                <span>${displayName} [${enchantments.length}/${item.enhancementSlots}]</span>
                <button data-action="select-item-for-enchant" data-item-index="${originalIndex}" class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">${isSelected ? 'Selected' : 'Select'}</button>
            </div>
            `;
        }).join('');

        if (enchantableEquipment.length === 0) {
            equipmentHtml = '<p class="text-slate-500 italic">No enchantable equipment in inventory.</p>';
        }

        // Determine the selected item to pass to the rune selection renderer
        const selectedItem = player.inventory[selectedItemIndex];

        modalContent.innerHTML = `
            <div id="enhancement-station-ui" class="grid md:grid-cols-2 gap-6">
                <div id="enhancement-left-panel">
                    <h4 class="text-lg font-semibold text-yellow-400 mb-3">1. Select Equipment to Enhance</h4>
                    <div class="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">${equipmentHtml}</div>
                </div>
                <div id="enhancement-right-panel" class="${selectedItemIndex !== null ? '' : 'opacity-50 pointer-events-none'}">
                    <h4 class="text-lg font-semibold text-yellow-400 mb-3">2. Select Rune to Apply</h4>
                    <p class="text-sm text-slate-300 mb-2">Enhancing: <span class="font-bold text-white">${selectedItem ? this.getItemDisplayName(selectedItem) : '...'}</span></p>
                    <div class="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">${this.renderRuneSelection(availableRunes, buildingIndex, selectedItemIndex)}</div>
                </div>
            </div>
        `;
    }

    renderRuneSelection(runes, buildingIndex, selectedItemIndex) {
        if (runes.length === 0) {
            return '<p class="text-slate-500 italic">No runes in inventory.</p>';
        }

        return runes.map(({ item, originalIndex }) => `
            <div class="p-2 bg-slate-700/50 rounded-md border border-slate-600 flex justify-between items-center">
                <span>${this.getItemDisplayName(item)} (x${item.quantity})</span>
                <button data-action="enchant-item" data-building-index="${buildingIndex}" data-item-index="${selectedItemIndex}" data-rune-index="${originalIndex}" class="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700" ${selectedItemIndex === null ? 'disabled' : ''}>Enchant</button>
            </div>
        `).join('');
    }

    renderAttackersGrid(entity, gameState) {
        if (!entity.attackers || entity.attackers.length === 0) return '';
        let html = '<div class="mt-1 border-t border-slate-600 pt-1"><div class="text-xs text-slate-400 mb-1">Attackers:</div><div class="space-y-1">';
        const allPlayersInCell = [gameState.player, ...(gameState.cell?.players || [])];
        entity.attackers.forEach(attackerId => {
            const attacker = allPlayersInCell.find(p => p && p.id === attackerId);
            if (attacker && attacker.stats && attacker.stats.hp !== null && attacker.stats.hp !== undefined) {
                const teamColorClass = (attacker.team && gameState.teams[attacker.team]) ? `text-${gameState.teams[attacker.team].color.split('-')[0]}-400` : 'text-gray-400';
                const safeHp = attacker.stats.hp || 0;
                html += `<div class="flex justify-between items-center text-xs"><span data-action="show-player-profile" data-player-id="${attacker.id}" class="font-semibold cursor-pointer hover:underline ${teamColorClass}">${attacker.name}</span><span class="text-slate-300">${safeHp.toFixed(0)} HP</span></div>`;
            }
        });
        return html + '</div></div>';
    }
    
    renderTeamsModal(gameState) {
        const player = gameState.player;
        if (!player) { this.dom.teamsModalContent.innerHTML = '<p class="text-red-400">No active player.</p>'; return; }
        
        // If player is not in a team OR is in the noobs team, show the create/join UI
        if (!player.team || (gameState.noobsTeamId && player.team === gameState.noobsTeamId)) {
            let currentTeamHtml = '';
            if (player.team && gameState.noobsTeamId && player.team === gameState.noobsTeamId) {
                const noobsTeam = gameState.teams[gameState.noobsTeamId];
                if (noobsTeam) {
                    const allPlayersInCell = [gameState.player, ...(gameState.cell?.players || [])];
                    const membersList = noobsTeam.members.map(pid => {
                        const member = allPlayersInCell.find(p => p && p.id === pid);
                        let name = `ID: ...${pid.slice(-4)}`;
                        if(member) {
                            name = member.name;
                        } else {
                            name = `${name} (Offline)`;
                        }
                        return `<span data-action="show-player-profile" data-player-id="${pid}" class="bg-slate-800 px-2 py-1 text-xs rounded-full cursor-pointer hover:underline">${name}</span>`
                    }).join(' ');
                    currentTeamHtml = `<div class="mb-6 p-3 rounded-md bg-slate-800/50 border border-${noobsTeam.color}"><div class="flex justify-between items-center"><div class="flex items-center gap-3"><div class="w-6 h-6 rounded-full bg-${noobsTeam.color}"></div><span class="font-semibold text-xl font-title text-white">${noobsTeam.name}</span></div><span class="text-xs text-slate-400">(Default Team)</span></div><p class="text-sm text-slate-400 mt-3 italic">${noobsTeam.description || 'No description.'}</p><div class="mt-3 pt-3 border-t border-slate-700 text-slate-400 text-sm">Members (${noobsTeam.members.length}): <div class="flex flex-wrap gap-1 mt-1">${membersList || 'None'}</div></div></div>`;
                }
            }
            
    
            const createTeamHtml = `<div class="bg-slate-700/50 p-4 rounded-md border border-slate-600">
                <h4 class="text-lg font-semibold text-yellow-400 mb-3">Create a New Team</h4>
                <div class="flex gap-2">
                    <input type="text" id="team-name-input" placeholder="Enter team name" class="flex-grow bg-slate-900 border border-slate-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none">
                    <button data-action="create-team" class="bg-green-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-700">Create</button>
                </div>
            </div>`;
            
            const joinTeamHtml = this.renderJoinTeamList(gameState);
            
            this.dom.teamsModalContent.innerHTML = `${currentTeamHtml}${createTeamHtml}<div class="mt-4">${joinTeamHtml}</div>`;
        } else {
            // Player is in a team, show the team management UI
            const team = gameState.teams[player.team];
            if (team) {
                this.dom.teamsModalContent.innerHTML = this.renderTeamManagement(team, player, gameState);
            } else {
                this.dom.teamsModalContent.innerHTML = `<p class="text-red-400">Error: Team data not found for player's team ID: ${player.team}.</p>`;
            }
        }
    }


    renderTeamManagement(team, player, gameState) {
        const isAdmin = team.adminId === player.id;
        const allPlayersInCell = [gameState.player, ...(gameState.cell?.players || [])];

        const membersList = team.members.map(pid => {
            const member = allPlayersInCell.find(p => p && p.id === pid);
            let name = `ID: ...${pid.slice(-4)}`;
            let adminTag = pid === team.adminId ? ' (Admin)' : '';
            if (member) {
                name = member.name;
            } else {
                name = `${name} (Offline)`;
            }
            return `<span data-action="show-player-profile" data-player-id="${pid}" class="bg-slate-800 px-2 py-1 text-xs rounded-full cursor-pointer hover:underline">${name}${adminTag}</span>`;
        }).join(' ');
        
        const requestsList = team.requests.map(req => {
            const requester = allPlayersInCell.find(p => p && p.id === req.requesterId);
            const requesterName = requester ? requester.name : `ID: ...${req.requesterId.slice(-4)}`;
            return `<div class="flex justify-between items-center bg-slate-800 p-2 rounded">
                <span data-action="show-player-profile" data-player-id="${req.requesterId}" class="cursor-pointer hover:underline">${requesterName}</span>
                ${isAdmin ? `<div>
                    <button data-action="resolve-join-request" data-team-id="${team.id}" data-requester-id="${req.requesterId}" data-decision="accept" class="bg-green-600 text-white px-2 py-1 text-xs rounded-md mr-1">Accept</button>
                    <button data-action="resolve-join-request" data-team-id="${team.id}" data-requester-id="${req.requesterId}" data-decision="reject" class="bg-red-600 text-white px-2 py-1 text-xs rounded-md">Reject</button>
                </div>` : ''}
            </div>`;
        }).join('');

        const adminSection = isAdmin ? `
            <div class="mt-4 bg-slate-700/50 p-4 rounded-md border border-slate-600">
                <h4 class="text-lg font-semibold text-yellow-400 mb-3">Admin Settings</h4>
                <div class="space-y-4">
                    <div>
                        <label for="team-desc-input-${team.id}" class="block text-sm font-medium text-slate-300 mb-1">Team Description</label>
                        <textarea id="team-desc-input-${team.id}" rows="2" class="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm">${team.description || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Join Policy</label>
                        <div class="flex gap-4">
                            <label><input type="radio" name="join-policy-${team.id}" value="open" ${team.joinPolicy === 'open' ? 'checked' : ''}> Open</label>
                            <label><input type="radio" name="join-policy-${team.id}" value="request" ${team.joinPolicy === 'request' ? 'checked' : ''}> Request</label>
                            <label><input type="radio" name="join-policy-${team.id}" value="closed" ${team.joinPolicy === 'closed' ? 'checked' : ''}> Closed</label>
                        </div>
                    </div>
                    <div>
                        <label for="team-color-input" class="block text-sm font-medium text-slate-300 mb-1">Team Color</label>
                        <select id="team-color-input" class="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2">
                            <option value="bg-gray-500" ${team.color === 'bg-gray-500' ? 'selected' : ''}>Gray</option>
                            <option value="bg-red-500" ${team.color === 'bg-red-500' ? 'selected' : ''}>Red</option>
                            <option value="bg-yellow-500" ${team.color === 'bg-yellow-500' ? 'selected' : ''}>Yellow</option>
                            <option value="bg-green-500" ${team.color === 'bg-green-500' ? 'selected' : ''}>Green</option>
                            <option value="bg-blue-500" ${team.color === 'bg-blue-500' ? 'selected' : ''}>Blue</option>
                            <option value="bg-indigo-500" ${team.color === 'bg-indigo-500' ? 'selected' : ''}>Indigo</option>
                            <option value="bg-purple-500" ${team.color === 'bg-purple-500' ? 'selected' : ''}>Purple</option>
                            <option value="bg-pink-500" ${team.color === 'bg-pink-500' ? 'selected' : ''}>Pink</option>
                        </select>
                    </div>
                    <button data-action="update-team-settings" data-team-id="${team.id}" class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700">Save Changes</button>
                </div>
            </div>
            ${team.requests.length > 0 ? `
            <div class="mt-4">
                <h4 class="text-lg font-semibold mb-2">Join Requests (${team.requests.length})</h4>
                <div class="space-y-2 max-h-48 overflow-y-auto">${requestsList}</div>
            </div>` : ''}
        ` : '';

        return `
            <div class="p-3 rounded-md bg-slate-800/50 border border-${team.color}">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 rounded-full ${team.color}"></div>
                        <span class="font-semibold text-xl font-title text-white">${team.name}</span>
                    </div>
                    <button data-action="leave-team" class="bg-red-600 text-white text-xs px-3 py-1 rounded-md hover:bg-red-700">Leave Team</button>
                </div>
                <p class="text-sm text-slate-400 mt-3 italic">${team.description || 'No description.'}</p>
                <div class="mt-3 pt-3 border-t border-slate-700 text-slate-400 text-sm">
                    Members (${team.members.length}): <div class="flex flex-wrap gap-1 mt-1">${membersList || 'None'}</div>
                </div>
            </div>
            ${adminSection}
        `;
    }

    renderJoinTeamList(gameState) {
        const teams = Object.values(gameState.teams || {}).filter(team => team.id !== gameState.noobsTeamId);
        if (teams.length === 0) {
            return `<div class="bg-slate-700/50 p-4 rounded-md border border-slate-600 mt-4 text-center text-slate-400">No teams have been formed yet.</div>`;
        }
        const teamsListHtml = teams.map(team => {
            const playerHasRequested = team.requests && team.requests.some(req => req.requesterId === gameState.player.id);
            let joinButtonHtml = '';
            if (team.joinPolicy === 'open') {
                joinButtonHtml = `<button data-action="join-team" data-team-id="${team.id}" class="bg-blue-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-700">Join</button>`;
            } else if (team.joinPolicy === 'request') {
                if (playerHasRequested) {
                    joinButtonHtml = `<button class="bg-gray-500 text-white font-semibold px-4 py-2 rounded-md cursor-not-allowed" disabled>Requested</button>`;
                } else {
                    joinButtonHtml = `<button data-action="request-to-join" data-team-id="${team.id}" class="bg-yellow-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-yellow-700">Request to Join</button>`;
                }
            } else { // closed
                joinButtonHtml = `<button class="bg-red-800 text-white font-semibold px-4 py-2 rounded-md cursor-not-allowed" disabled>Closed</button>`;
            }
            
            return `
                <div class="bg-slate-800/50 p-3 rounded-md border border-slate-700 flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2">
                            <div class="w-4 h-4 rounded-full ${team.color}"></div>
                            <span class="font-semibold text-white">${team.name}</span>
                        </div>
                        <p class="text-xs text-slate-400 mt-1 italic">${team.description || 'No description.'} (${team.members.length} members)</p>
                    </div>
                    ${joinButtonHtml}
                </div>
            `;
        }).join('');
        return `
            <div class="bg-slate-700/50 p-4 rounded-md border border-slate-600">
                <h4 class="text-lg font-semibold text-yellow-400 mb-3">Join an Existing Team</h4>
                <div class="space-y-2 max-h-64 overflow-y-auto">${teamsListHtml}</div>
            </div>
        `;
    }


    renderPlayerProfileModal(player, gameState, canAttack) {
        let content = '';

        const team = player.team && gameState.teams ? gameState.teams[player.team] : null;
        const teamColorClass = team ? `text-${this.tailwindColorMap[team.color].split('-')[0]}-400` : 'text-gray-400';
        const teamName = team ? team.name : 'No Team';
        const stats = player.stats || {};
        const safeStats = {
            hp: stats.hp || 0, maxHp: stats.maxHp || 1, mp: stats.mp || 0, maxMp: stats.maxMp || 1,
            stamina: stats.stamina || 0, maxStamina: stats.maxStamina || 1, dmg: stats.dmg || 0,
            speed: stats.speed || 0, critical: stats.critical || 0, dodge: stats.dodge || 0
        };

        // Header
        content += `<div class="text-center mb-4">
            <h3 class="text-2xl font-title ${teamColorClass}">${player.name}</h3>
            <p class="text-slate-400">Level ${player.level || 1} ${teamName}</p>
        </div>`;
        
        // Stats
        content += `<div class="mb-4">
            <h4 class="text-lg font-semibold text-yellow-400 mb-2">Stats</h4>
            <div class="space-y-2">
                ${this.createBar(safeStats.hp, safeStats.maxHp, 'hp', `HP: ${safeStats.hp.toFixed(0)}/${safeStats.maxHp.toFixed(0)}`).outerHTML}
                ${this.createBar(safeStats.mp, safeStats.maxMp, 'mp', `MP: ${safeStats.mp.toFixed(0)}/${safeStats.maxMp.toFixed(0)}`).outerHTML}
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                ${this.createStatDisplay('⚔️', 'Damage', safeStats.dmg.toFixed(1))}
                ${this.createStatDisplay('🏃', 'Speed', safeStats.speed.toFixed(1))}
                ${this.createStatDisplay('🎯', 'Critical', `${safeStats.critical.toFixed(1)}%`)}
                ${this.createStatDisplay('💨', 'Dodge', `${safeStats.dodge.toFixed(1)}%`)}
            </div>
        </div>`;
        
        // Equipment
        content += `<div class="mb-4">
            <h4 class="text-lg font-semibold text-yellow-400 mb-2">Equipment</h4>
            ${this.renderEquipment(player, true)}
        </div>`;
        
        this.dom.playerProfileContent.innerHTML = content;
    }


    renderBuildModal(gameState) {
        const buildModalContent = this.dom.buildModalContent;
        if (!gameState.buildingTemplates) {
            buildModalContent.innerHTML = `<p class="text-red-500">Building templates not loaded yet.</p>`;
            return;
        }

        let content = Object.values(gameState.buildingTemplates).map(template => {
            const hasMaterials = template.materials.every(mat => {
                const playerItem = gameState.player.inventory.find(item => item.name === mat.name);
                return playerItem && playerItem.quantity >= mat.quantity;
            });
            const materialList = template.materials.map(m => {
                const playerItem = gameState.player.inventory.find(item => item.name === m.name);
                const playerQty = playerItem ? playerItem.quantity : 0;
                const hasEnough = playerQty >= m.quantity;
                return `<span class="${hasEnough ? 'text-green-400' : 'text-red-400'}">${playerQty}/${m.quantity} ${m.name}</span>`;
            }).join(', ');
            
            return `
                <div class="p-3 bg-slate-900/50 rounded-md border ${hasMaterials ? 'border-slate-600' : 'border-red-800/50'}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-white">${template.name}</span>
                        <button data-action="build-building" data-building-name="${template.name}" ${!hasMaterials ? 'disabled' : ''} 
                                class="px-3 py-1 text-sm rounded ${hasMaterials ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 cursor-not-allowed'}">
                            Build
                        </button>
                    </div>
                    <p class="text-xs text-slate-400 mt-1">${template.description}</p>
                    <p class="text-xs text-slate-400 mt-2">Materials: ${materialList}</p>
                </div>
            `;
        }).join('');
        
        buildModalContent.innerHTML = content;
    }

    createTeamSection(player, gameState) {
        if (player.team && gameState.teams && gameState.teams[player.team]) {
            const team = gameState.teams[player.team];
            const teamColor = team.color || 'bg-gray-500';
            return `<button data-action="open-teams-modal" class="w-full text-left p-2 rounded-md ${teamColor} text-white font-bold text-sm hover:opacity-90 transition-opacity">🛡️ ${team.name}</button>`;
        } else if (gameState.noobsTeamId) {
            const team = gameState.teams[gameState.noobsTeamId];
            const teamColor = team.color || 'bg-gray-500';
            return `<button data-action="open-teams-modal" class="w-full text-left p-2 rounded-md ${teamColor} text-white font-bold text-sm hover:opacity-90 transition-opacity">🛡️ ${team.name}</button>`;
        } else {
            return `<button data-action="open-teams-modal" class="w-full text-left p-2 rounded-md bg-gray-600 text-white font-bold text-sm hover:bg-gray-700 transition-colors">🛡️ No Team</button>`;
        }
    }

    renderCharacterPanel(gameState) {
        const player = gameState.player;
        if (!player) return;
    
        const headerContainer = document.getElementById('character-panel-header');
        const characterContainer = document.getElementById('character-panel-full');

        if (!headerContainer || !characterContainer) return;

        const teamSectionHtml = this.createTeamSection(player, gameState);
        const isDeadHtml = player.isDead ? `<div class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10"><h2 class="text-5xl font-title text-red-500 mb-4">You are Dead</h2><button data-action="respawn" class="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Respawn</button></div>` : '';

        const headerHtml = `
            ${isDeadHtml}
            <div class="flex justify-between items-center">
                <div data-action="show-player-profile" data-player-id="${player.id}" class="cursor-pointer">
                    <h2 class="text-2xl font-title text-yellow-400">${player.name}</h2>
                    <p class="text-sm text-slate-300">Level ${player.level || 1}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-grow">
                        ${teamSectionHtml}
                    </div>
                    <button id="toggle-character-panel-btn" data-action="toggle-character-panel" class="p-2 bg-slate-700 rounded-md hover:bg-slate-600">
                        <svg id="toggle-icon" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        headerContainer.innerHTML = headerHtml;
        this.updateCharacterView(player);
        this.toggleCharacterPanel(this.clientState.isCharacterPanelCollapsed, true);
    }
    

    createTabButton(tabName, tabText, isActive = false) {
        return `<button class="tab-button whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${isActive ? 'active' : ''}" data-tab="${tabName}">${tabText}</button>`;
    }


    showEnemyInfo(enemy) {
        if (!enemy) return;
        const modal = this.dom.modals.enemyInfo;
        const title = modal.querySelector('#enemy-info-title');
        const content = modal.querySelector('#enemy-info-content');

        title.textContent = `${enemy.name} (Lvl ${enemy.level})`;
        
        let htmlContent = `<div class="space-y-3">`;

        // Stats
        if (enemy.stats) {
            const stats = enemy.stats;
            const safeStats = {
                hp: stats.hp || 0, maxHp: stats.maxHp || 1, mp: stats.mp || 0, maxMp: stats.maxMp || 1,
                dmg: stats.dmg || 0, speed: stats.speed || 0, critical: stats.critical || 0, dodge: stats.dodge || 0
            };
            htmlContent += `<div>
                <h4 class="font-semibold text-yellow-400 mb-2">Stats</h4>
                ${this.createBar(safeStats.hp, safeStats.maxHp, 'hp', `HP: ${safeStats.hp.toFixed(0)}/${safeStats.maxHp.toFixed(0)}`).outerHTML}
                <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                    ${this.createStatDisplay('⚔️', 'Damage', safeStats.dmg.toFixed(1))}
                    ${this.createStatDisplay('🏃', 'Speed', safeStats.speed.toFixed(1))}
                    ${this.createStatDisplay('🎯', 'Critical', `${safeStats.critical.toFixed(1)}%`)}
                    ${this.createStatDisplay('💨', 'Dodge', `${safeStats.dodge.toFixed(1)}%`)}
                </div>
            </div>`;
        }

        // Loot Table Preview (if available)
        if (enemy.loot && enemy.loot.length > 0) {
            htmlContent += `<div>
                <h4 class="font-semibold text-yellow-400 mb-2">Loot</h4>
                <div class="flex flex-wrap gap-2">
                    ${enemy.loot.map(item => `<span class="bg-slate-700 px-2 py-1 text-xs rounded-full">${item.name}</span>`).join('')}
                </div>
            </div>`;
        }
        
        // Description
        if (enemy.description) {
            htmlContent += `<div>
                <h4 class="font-semibold text-yellow-400 mb-2">Description</h4>
                <p class="text-sm text-slate-300 italic">${enemy.description}</p>
            </div>`;
        }
        
        htmlContent += `</div>`;
        
        content.innerHTML = htmlContent;
        modal.classList.remove('hidden');
    }

    renderMapView(gameState) {
        const grid = this.dom.mainViewContent;
        grid.innerHTML = '';
        grid.className = 'flex flex-col items-center justify-center h-full overflow-y-auto';
        
        const biomeMap = gameState.biomeMap || {};
        const player = gameState.player;
        const { x: playerX, y: playerY } = player;
        const constructionSites = this.clientState.constructionSites || {};
        
        const teams = gameState.teams || {};

        const mapSize = 20;
        const containerSize = grid.clientWidth * 0.95;
        const tileSize = Math.floor(containerSize / mapSize);
        
        this.dom.mainViewTitle.innerHTML = '🗺️ World Map';

        const mapContainer = document.createElement('div');
        mapContainer.style.display = 'grid';
        mapContainer.style.gridTemplateColumns = `repeat(${mapSize}, ${tileSize}px)`;
        mapContainer.style.gridTemplateRows = `repeat(${mapSize}, ${tileSize}px)`;
        mapContainer.style.width = `${mapSize * tileSize}px`;
        mapContainer.style.height = `${mapSize * tileSize}px`;
        mapContainer.style.margin = 'auto'; // Center the map
        
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = document.createElement('div');
                tile.style.width = `${tileSize}px`;
                tile.style.height = `${tileSize}px`;
                tile.style.fontSize = `${tileSize / 4}px`;
                tile.className = 'flex items-center justify-center border-slate-700 transition-colors duration-200 cursor-pointer hover:border-yellow-400';
                tile.style.borderWidth = '1px';
                tile.dataset.action = 'move-to-tile';
                tile.dataset.x = x;
                tile.dataset.y = y;

                const biomeKey = biomeMap[`${x},${y}`];
                const biome = CONFIG.BIOMES[biomeKey] || { color: 'bg-gray-900', borderColor: 'border-gray-700' };
                tile.classList.add(biome.color);
                
                if (x === playerX && y === playerY) {
                    tile.innerHTML = '<span>🙂</span>';
                    tile.style.boxShadow = `0 0 ${tileSize/2}px #fff`;
                    tile.style.zIndex = '10';
                    tile.style.position = 'relative';
                }
                
                const siteTeamId = constructionSites[`${x},${y}`];
                if (siteTeamId) {
                    const team = teams[siteTeamId];
                    const hexColor = team ? team.color : '#ffffff';
                    tile.style.border = `2px solid ${hexColor}`;
                    tile.innerHTML = '<span>🏰</span>';
                }

                mapContainer.appendChild(tile);
            }
        }
        
        grid.appendChild(mapContainer);

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'grid grid-cols-3 gap-1 mt-4 w-48';
        controlsContainer.innerHTML = `
            <button data-action="move-direction" data-direction="up-left" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">↖️</button>
            <button data-action="move-direction" data-direction="up" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">⬆️</button>
            <button data-action="move-direction" data-direction="up-right" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">↗️</button>
            <button data-action="move-direction" data-direction="left" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">⬅️</button>
            <div class="flex items-center justify-center text-white font-bold text-lg"></div>
            <button data-action="move-direction" data-direction="right" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">➡️</button>
            <button data-action="move-direction" data-direction="down-left" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">↙️</button>
            <button data-action="move-direction" data-direction="down" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">⬇️</button>
            <button data-action="move-direction" data-direction="down-right" class="bg-blue-600 text-white font-semibold py-2 rounded text-lg hover:bg-blue-700 transition-colors">↘️</button>
        `;
        grid.appendChild(controlsContainer);
    }
    
    createPlayerCard(player, gameState, activePlayer) {
        // Force using the most up-to-date player object for the client's own character.
        if (player.id === activePlayer.id) {
            player = activePlayer;
        }

        const card = document.createElement('div');
        card.className = 'enemy-card h-20 md:h-24 flex flex-col';
        card.dataset.entityId = player.id;
        
        const isAttackingThis = activePlayer.attackingPlayer === player.id;
        const attackRing = isAttackingThis ? `ring-4 ring-offset-2 ring-offset-slate-800 ring-red-500` : '';
        
        const team = player.team && gameState.teams ? gameState.teams[player.team] : null;
        const teamColor = team ? team.color : 'bg-gray-500';
        const borderColor = team ? teamColor.replace('bg', 'border') : 'border-gray-500';
        const teamTextColor = team ? `text-${teamColor.split('-')[0]}-400` : 'text-gray-400';
        
        const currentHp = player.stats?.hp || 0;
        const maxHp = player.stats?.maxHp || 1;

        let attackBtn = '';
        if (player.id !== activePlayer.id) {
             const canPlayerAttack = (player.team !== activePlayer.team) || (team && team.id === gameState.noobsTeamId);
             if (canPlayerAttack) {
                 attackBtn = `<button data-action="attack" data-target-id="${player.id}" class="mt-1 bg-red-800/50 text-white font-bold py-1 px-2 rounded hover:bg-red-700 text-xs self-center">Attack</button>`;
             }
        }


        card.innerHTML = `<div class="relative bg-slate-900/50 ${borderColor} border rounded-lg p-1 flex flex-col justify-between transition-all hover:shadow-xl hover:bg-slate-800/70 cursor-pointer ${attackRing} h-full" data-action="show-player-profile" data-player-id="${player.id}">
            <div>
                <div class="font-bold text-center ${teamTextColor} text-xs">${player.name}</div>
                <div class="text-xs text-center text-slate-300">Lvl ${player.level || 1}</div>
                <div class="entity-hp-text text-xs text-center text-slate-400">${currentHp.toFixed(0)}/${maxHp.toFixed(0)}</div>
                ${this.createBar(currentHp, maxHp, 'hp').outerHTML}
            </div>
            ${attackBtn}
        </div>`;
        
        return card;
    }


    createMobCard(mob, player, site) {
        const card = document.createElement('div');
        card.className = 'enemy-card h-20 md:h-24 flex flex-col';
        card.dataset.entityId = mob.id;
        
        const isAttackingThis = player.attackingMob === mob.id;
        const attackRing = isAttackingThis ? `ring-4 ring-offset-2 ring-offset-slate-800 ring-red-500` : '';
        const currentHp = mob.stats?.hp || 0;
        const maxHp = mob.stats?.maxHp || 1;
        
        let canAttack = true;
        if (site && player.team === site.team && !mob.isBoss) {
            // Team member inside their own castle can't attack non-boss mobs
            canAttack = false;
        }

        const attackAction = canAttack ? `data-action="attack" data-target-id="${mob.id}"` : '';

        card.innerHTML = `<div class="relative bg-slate-900/50 border border-slate-700 rounded-lg p-1 flex flex-col justify-between transition-all hover:shadow-xl hover:bg-slate-800/70 cursor-pointer ${attackRing} h-full" ${attackAction}>
            <div class="absolute top-1 right-1 w-4 h-4 bg-slate-700 text-white text-xs rounded-full flex items-center justify-center" data-action="show-enemy-info" data-enemy-id="${mob.id}">?</div>
            <div>
                <div class="font-bold text-center text-red-400 text-xs">${mob.name}</div>
                <div class="text-xs text-center text-slate-300">Lvl ${mob.level || 1}</div>
                <div class="entity-hp-text text-xs text-center text-slate-400">${currentHp.toFixed(0)}/${maxHp.toFixed(0)}</div>
                ${this.createBar(currentHp, maxHp, 'hp').outerHTML}
            </div>
        </div>`;
        return card;
    }
    
    toggleCharacterPanel(isCollapsed, isInitial = false) {
        const characterViewContainer = document.getElementById('character-view-container');
        const characterPanelFull = document.getElementById('character-panel-full');
        const toggleIcon = document.getElementById('toggle-icon');

        if (!characterViewContainer || !characterPanelFull || !toggleIcon) return;

        if (!isInitial) {
            characterViewContainer.style.transition = 'height 0.3s ease';
        }

        if (isCollapsed) {
            characterPanelFull.classList.add('hidden');
            characterViewContainer.style.height = 'auto';
            toggleIcon.style.transform = 'rotate(180deg)';
        } else {
            characterPanelFull.classList.remove('hidden');
            characterViewContainer.style.height = '50%';
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }


    createBar(current, max, type, label = '') {
        const percentage = max > 0 ? (current / max) * 100 : 0;
        const bar = document.createElement('div');
        bar.className = 'w-full bg-slate-900/50 rounded-full h-5 border border-slate-600 relative overflow-hidden';
        bar.innerHTML = `
            <div class="${type}-bar-foreground h-full rounded-full" style="width: ${percentage}%"></div>
            <div class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/90" style="text-shadow: 1px 1px 2px #000;">${label}</div>`;
        return bar;
    }

    createStatDisplay(icon, label, value) {
        return `<div class="flex items-center justify-between bg-slate-800/50 p-2 rounded-md">
            <span class="text-slate-300">${icon} ${label}</span>
            <span class="font-semibold text-white">${value}</span>
        </div>`;
    }
}
