class GameClient {
    constructor() {
        this.ws = null;
        this.gameState = {};
        this.staticData = {}; // Store static data received once on login
        this.clientState = {
            activeTab: 'character',
            showMapView: false,
            constructionSites: {}, // x,y -> teamColor
            selectedEnhancementItem: null,
            lastBuildingIndex: null,
            lastBuildingType: null,
            isCharacterPanelCollapsed: false,
            lastDamageTaken: null,
        };

        this.dom = {
            mainViewContent: document.getElementById('main-view-content'),
            mainViewTitle: document.getElementById('main-view-title'),
            characterPanel: document.getElementById('character'),


            modals: {
                login: document.getElementById('login-modal'),
                playerProfile: document.getElementById('player-profile-modal'),
                build: document.getElementById('build-modal'),
                teams: document.getElementById('teams-modal'),
                itemPopup: document.getElementById('item-popup-modal'),
                enemyInfo: document.getElementById('enemy-info-modal'),
                enhancement: document.getElementById('enhancement-modal'),
            },
            itemPopup: {
                modal: document.getElementById('item-popup-modal'),
                title: document.getElementById('item-popup-title'),
                content: document.getElementById('item-popup-content'),
                closeButton: document.getElementById('close-item-popup'),
            },
            playerProfileContent: document.getElementById('player-profile-content'),
            buildModalContent: document.getElementById('build-modal-content'),
            teamsModalContent: document.getElementById('teams-modal-content'),

            connection: {
                status: document.getElementById('connection-status'),
                text: document.getElementById('connection-text')
            }
        };
        this.renderer = new Renderer(this.dom, this.clientState, this);
    }

    connect(url) {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => this.onOpen();
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onclose = () => this.onClose();
        this.ws.onerror = () => this.onClose();
    }

    onOpen() {
        this.dom.connection.status.classList.replace('disconnected', 'connected');
        this.dom.connection.text.textContent = 'Connected';
        this.dom.modals.login.classList.remove('hidden');
    }

    onClose() {
        this.dom.connection.status.classList.replace('connected', 'disconnected');
        this.dom.connection.text.textContent = 'Disconnected. Refresh to retry.';
        this.dom.modals.login.classList.add('hidden');
    }

    onMessage(event) {
        const payload = JSON.parse(event.data);
        
        switch (payload.type) {
            case 'log': 
                console.log(payload.message); 
                break;
            case 'combatLog': 
                if (payload.message.includes('deals') && payload.message.includes(`damage to ${this.gameState.player.name}`)) {
                    const damageMatch = payload.message.match(/deals ([\d\.]+) damage/);
                    if (damageMatch && damageMatch[1]) {
                        this.clientState.lastDamageTaken = parseFloat(damageMatch[1]);
                        console.log(`[Client Patch] Logged ${this.clientState.lastDamageTaken} damage for ${this.gameState.player.name}`);
                    }
                }
                console.log(`[Combat] ${payload.message}`); 
                break;
            case 'error': 
                console.error(`Error: ${payload.message}`); 
                break;

            case 'loginSuccess':
                console.log(`Welcome, ${payload.player.name}!`);
                this.dom.modals.login.classList.add('hidden');
                break;
            case 'staticData':
                console.log('Received static data:', payload.data);
                if (payload.data.buildingTemplates) {
                    this.staticData = payload.data;
                    if (payload.data.constructionSites) {
                        this.clientState.constructionSites = {}; // Clear existing sites
                        payload.data.constructionSites.forEach(site => {
                            this.clientState.constructionSites[`${site.x},${site.y}`] = site.team;
                        });
                    }
                }
                if (payload.data.teams) {
                    this.gameState.teams = payload.data.teams;
                    if (this.staticData) this.staticData.teams = payload.data.teams;
                    if (payload.data.noobsTeamId) {
                        this.gameState.noobsTeamId = payload.data.noobsTeamId;
                        if (this.staticData) this.staticData.noobsTeamId = payload.data.noobsTeamId;
                    }
                    const player = this.gameState.player;
                    if (player) {
                        const playerTeam = Object.values(payload.data.teams).find(team => team.adminId === player.id);
                        if (playerTeam) {
                            this.gameState.player.team = playerTeam.id;
                        }
                    }
                    const teamsModal = document.getElementById('teams-modal');
                    if (!teamsModal.classList.contains('hidden')) {
                        this.renderer.renderTeamsModal(this.gameState);
                    }
                }

                break;
            case 'constructionUpdate':
                payload.sites.forEach(site => {
                    this.clientState.constructionSites[`${site.x},${site.y}`] = site.team;
                });
                if (this.clientState.showMapView) {
                    this.renderer.renderMapView(this.gameState);
                } else {
                    this.renderer.renderAreaView(this.gameState);
                }
                break;
            case 'gameState':
                const previousState = this.gameState;
                this.gameState = payload.state;

                // --- FIX: PERSIST STATIC DATA ---
                // Merge the biomeMap and other static data back into the gameState
                if (this.staticData) {
                    this.gameState.biomeMap = this.staticData.biomeMap;
                    this.gameState.teams = this.staticData.teams;
                    this.gameState.noobsTeamId = this.staticData.noobsTeamId;
                    this.gameState.enemyTemplates = this.staticData.enemyTemplates;
                    this.gameState.buildingTemplates = this.staticData.buildingTemplates;
                    this.gameState.craftingRecipes = this.staticData.craftingRecipes;

                    // Merge enemy data to preserve loot tables
                    if (previousState && previousState.cell && previousState.cell.objects) {
                        this.gameState.cell.objects.forEach(enemy => {
                            if (enemy.type === 'mob') {
                                const previousEnemy = previousState.cell.objects.find(o => o.id === enemy.id);
                                if (previousEnemy && previousEnemy.loot) {
                                    enemy.loot = previousEnemy.loot;
                                }
                            }
                        });
                    }
                }
                
                // Always do a full re-render to ensure data consistency, bypassing partial update logic.
                this.renderer.renderAll(this.gameState, previousState);

                
                // --- Enhanced Storage Modal Auto-Refresh ---
                const buildingModal = document.getElementById('building-modal');
                if (!buildingModal.classList.contains('hidden')) {
                    const lastBuildingIndex = this.clientState.lastBuildingIndex;
                    const lastBuildingType = this.clientState.lastBuildingType;
                    
                    if (typeof lastBuildingIndex === 'number' && lastBuildingType && 
                        (lastBuildingType === 'storage' || lastBuildingType === 'personal_storage')) {
                        
                        const site = this.gameState.cell.objects.find(o => 
                            o.type === 'construction_site' && o.team === this.gameState.player.team
                        );
                        
                        if (site && site.buildings && site.buildings[lastBuildingIndex]) {
                            const building = site.buildings[lastBuildingIndex];
                            
                            // Only re-render if building data actually changed
                            const buildingChanged = !previousState || 
                                !previousState.cell || 
                                !previousState.cell.objects ||
                                !previousState.cell.objects.find(o => 
                                    o.type === 'construction_site' && o.team === this.gameState.player.team
                                )?.buildings?.[lastBuildingIndex] ||
                                JSON.stringify(building) !== JSON.stringify(
                                    previousState.cell.objects.find(o => 
                                        o.type === 'construction_site' && o.team === this.gameState.player.team
                                    )?.buildings?.[lastBuildingIndex]
                                );
                            
                            if (buildingChanged) {
                                this.renderer.renderBuildingModal(building, lastBuildingIndex, this.gameState.player, this.gameState);
                            }
                        } else {
                            // Building no longer exists, close modal
                            buildingModal.classList.add('hidden');
                            this.clientState.lastBuildingIndex = null;
                            this.clientState.lastBuildingType = null;
                        }
                    }
                }
                
                // --- Teams Modal Auto-Refresh ---
                const teamsModal = document.getElementById('teams-modal');
                if (!teamsModal.classList.contains('hidden')) {
                    // Only refresh if teams data actually changed
                    const previousTeams = previousState?.teams || {};
                    const currentTeams = this.gameState.teams || {};
                    const teamsChanged = JSON.stringify(previousTeams) !== JSON.stringify(currentTeams);
                    
                    if (teamsChanged) {
                        this.renderer.renderTeamsModal(this.gameState);
                    }
                }
                break;
        }
    }

    sendCommand(action, data = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ action, ...data }));
    }

    init() {
        this.bindEvents();
        //this.connect('ws://45.155.102.148:8080');
        this.connect('ws://localhost:8080');
        // Don't render until we have game state
    }

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    bindEvents() {
        window.addEventListener('resize', this.debounce(() => {
            if (this.clientState.showMapView) {
                this.renderer.renderMapView(this.gameState);
            }
        }, 250));

        document.body.addEventListener('click', (e) => {
            // Handle item name clicks for popup
            if (e.target.classList.contains('item-name-clickable')) {
                const itemSlot = e.target.dataset.itemSlot;
                const itemType = e.target.dataset.itemType || 'inventory';
                const player = this.gameState.player;
                
                if (player) {
                    let item = null;
                    if (itemType === 'inventory') {
                        const itemIndex = parseInt(e.target.dataset.itemIndex, 10);
                        if (player.inventory && player.inventory[itemIndex]) {
                            item = player.inventory[itemIndex];
                        }
                    } else if (itemType === 'equipment') {
                        item = player.equipment && player.equipment[itemSlot];
                    } else if (itemType === 'storage') {
                        // Handle storage items
                        const itemIndex = parseInt(e.target.dataset.itemIndex, 10);
                        const buildingIndex = parseInt(e.target.dataset.buildingIndex, 10);
                        const storageType = e.target.dataset.storageType;
                        const site = this.gameState.cell?.objects.find(o => o.type === 'construction_site' && o.team === player.team);
                        if (site && site.buildings && site.buildings[buildingIndex]) {
                            const building = site.buildings[buildingIndex];
                            if (storageType === 'personal_storage' && building.playerInventories && building.playerInventories[player.id]) {
                                item = building.playerInventories[player.id][itemIndex];
                            } else if (storageType === 'storage' && building.inventory) {
                                item = building.inventory[itemIndex];
                            }
                        }
                    }
                    
                    if (item) {
                        this.showItemPopup(item);
                        return;
                    }
                }
            }
            
            const actionHolder = e.target.closest('[data-action]');
            if (!actionHolder) return;

            const { action, teamId, tab, targetId, slot, itemIndex, channel, requesterId, decision, playerId, buildingName, recipeId, storageType, buildingIndex, enemyId } = actionHolder.dataset;
            switch (action) {
                case 'login': this.sendCommand('login', { name: document.getElementById('player-name-input').value, password: document.getElementById('player-password-input').value }); break;
                case 'open-teams-modal': this.renderer.renderTeamsModal(this.gameState); this.dom.modals.teams.classList.remove('hidden'); break;
                case 'attack': this.sendCommand('attack', { targetId }); break;
                case 'build': this.sendCommand('build'); break;
                case 'donate': this.sendCommand('donate'); break;
                case 'deploySiege': this.sendCommand('deploySiege'); break;
                case 'go-outside': this.sendCommand('go-outside'); break;
                case 'go-inside': this.sendCommand('go-inside'); break;
                case 'respawn': this.sendCommand('respawn'); break;
                case 'show-enemy-info':
                    const enemy = this.gameState.cell.objects.find(o => o.id === enemyId);
                    if (enemy) {
                        this.renderer.showEnemyInfo(enemy);
                    }
                    break;


                case 'equip-item': this.sendCommand('equip-item', { itemIndex: parseInt(itemIndex, 10) }); break;
                case 'unequip-item': this.sendCommand('unequip-item', { slot }); break;
                case 'use-item': this.sendCommand('use-item', { itemIndex: parseInt(itemIndex, 10) }); break;
                case 'create-team': 
                    const teamName = document.getElementById('team-name-input').value.trim(); 
                    if (teamName) {
                        this.sendCommand('create-team', { teamName });
                        // Manually update the client-side state to show the new team immediately
                        const newTeamId = `team_${Date.now()}`; // Temporary ID, will be updated by server
                        this.gameState.teams[newTeamId] = {
                            id: newTeamId,
                            name: teamName,
                            adminId: this.gameState.player.id,
                            members: [this.gameState.player.id],
                            requests: [],
                            joinPolicy: 'request',
                            description: '',
                            color: 'gray-500' // Default color
                        };
                        this.gameState.player.team = newTeamId;
                        this.renderer.renderTeamsModal(this.gameState);
                        document.getElementById('team-name-input').value = '';
                    }
                    break;
                case 'join-team': 
                    this.sendCommand('join-team', { teamId }); 
                    break;
                case 'leave-team': 
                    this.sendCommand('leave-team'); 
                    break;
                case 'request-to-join': 
                    this.sendCommand('request-to-join', { teamId }); 
                    break;
                case 'update-team-settings': {
                    const colorInput = document.getElementById('team-color-input');
                    const newColor = colorInput ? colorInput.value : undefined;
                    const newDescription = document.getElementById(`team-desc-input-${teamId}`).value;
                    const newJoinPolicy = document.querySelector(`input[name="join-policy-${teamId}"]:checked`).value;

                    this.sendCommand('update-team-settings', { 
                        teamId, 
                        description: newDescription,
                        joinPolicy: newJoinPolicy,
                        color: newColor
                    });

                    // Optimistic update
                    if (this.gameState.teams && this.gameState.teams[teamId]) {
                        if (newColor) {
                            this.gameState.teams[teamId].color = newColor;
                            if (this.staticData.teams) this.staticData.teams[teamId].color = newColor;
                        }
                        this.gameState.teams[teamId].description = newDescription;
                        this.gameState.teams[teamId].joinPolicy = newJoinPolicy;
                        if (this.staticData.teams) {
                            this.staticData.teams[teamId].description = newDescription;
                            this.staticData.teams[teamId].joinPolicy = newJoinPolicy;
                        }
                        this.renderer.renderTeamsModal(this.gameState);
                    }
                    break;
                }
                case 'resolve-join-request': 
                    this.sendCommand('resolve-join-request', { teamId, requesterId, decision }); 
                    break;

                case 'show-player-profile': 
                    const allPlayers = [this.gameState.player, ...(this.gameState.cell?.players || [])];
                    const p = allPlayers.find(pl => pl && pl.id === playerId); 
                    if (p) { this.renderer.renderPlayerProfileModal(p, this.gameState, true); this.dom.modals.playerProfile.classList.remove('hidden'); } 
                    break;
                case 'open-build-modal': 
                    // Ensure static data is available before rendering
                    if (this.staticData && this.staticData.buildingTemplates) {
                        this.gameState.buildingTemplates = this.staticData.buildingTemplates;
                    }
                    this.renderer.renderBuildModal(this.gameState); 
                    this.dom.modals.build.classList.remove('hidden'); 
                    break;
                case 'build-building': this.sendCommand('build-building', { buildingName }); this.dom.modals.build.classList.add('hidden'); break;
                case 'close-modal': 
                    Object.values(this.dom.modals).forEach(m => m.classList.add('hidden'));
                    document.getElementById('building-modal').classList.add('hidden');
                    break;

                case 'open-building': 
                    console.log('Opening building modal for index:', buildingIndex);
                    const buildingIndexInt = parseInt(buildingIndex, 10);
                    const site = this.gameState.cell.objects.find(o => o.type === 'construction_site' && o.team === this.gameState.player.team);
                    console.log('Found site:', site);
                    if (site && site.buildings && site.buildings[buildingIndexInt]) {
                        const building = site.buildings[buildingIndexInt];
                        this.clientState.lastBuildingIndex = buildingIndexInt;
                        this.clientState.lastBuildingType = building.type;

                        if (building.type === 'enhancement') {
                            this.clientState.selectedEnhancementItem = null;
                            this.renderer.renderEnhancementModal(building, buildingIndexInt, this.gameState.player, null);
                            this.dom.modals.enhancement.classList.remove('hidden');
                        } else {
                            this.renderer.renderBuildingModal(building, buildingIndexInt, this.gameState.player, this.gameState);
                            document.getElementById('building-modal').classList.remove('hidden');
                        }
                    } else {
                        console.log('Building not found or site not found');
                    }
                    break;
                case 'select-item-for-enchant': {
                    // Find the building index from the last opened building
                    const buildingIndexInt = this.clientState.lastBuildingIndex;
                    const itemIndexInt = parseInt(itemIndex, 10);
                    
                    const site = this.gameState.cell.objects.find(o => o.type === 'construction_site' && o.team === this.gameState.player.team);
                    const building = site?.buildings?.[buildingIndexInt];
                    
                    if (building) {
                        if (this.clientState.selectedEnhancementItem === itemIndexInt) {
                            this.clientState.selectedEnhancementItem = null; // Deselect
                        } else {
                            this.clientState.selectedEnhancementItem = itemIndexInt; // Select
                        }
                        // Re-render the modal with the new selection state
                        this.renderer.renderEnhancementModal(building, buildingIndexInt, this.gameState.player, this.clientState.selectedEnhancementItem);
                    }
                    break;
                }
                case 'enchant-item': {
                    const buildingIndexInt = parseInt(actionHolder.dataset.buildingIndex, 10);
                    const itemIndexInt = parseInt(actionHolder.dataset.itemIndex, 10);
                    const runeIndexInt = parseInt(actionHolder.dataset.runeIndex, 10);
                    this.sendCommand('enchant-item', { 
                        buildingIndex: buildingIndexInt, 
                        itemIndex: itemIndexInt,
                        runeIndex: runeIndexInt
                    });
                    // Close the modal after enchanting
                    this.dom.modals.enhancement.classList.add('hidden');
                    this.clientState.selectedEnhancementItem = null; 
                    break;
                }
                case 'deposit-storage': 
                    this.sendCommand('deposit-storage', { 
                        buildingIndex: parseInt(buildingIndex), 
                        itemIndex: parseInt(itemIndex), 
                        storageType, 
                        quantity: parseInt(actionHolder.dataset.quantity) || 1
                    }); 
                    break;
                case 'withdraw-storage': this.sendCommand('withdraw-storage', { buildingIndex: parseInt(buildingIndex), itemIndex: parseInt(itemIndex), storageType }); break;
                case 'craft-item': this.sendCommand('craft-item', { buildingIndex: parseInt(buildingIndex), recipeId: parseInt(recipeId) }); break;
                case 'toggle-map-view': 
                    this.clientState.showMapView = !this.clientState.showMapView;
                    const characterView = document.getElementById('character-view-container');
                    const areaView = document.getElementById('area-view-container');
                    if (this.clientState.showMapView) {
                        characterView.style.display = 'none';
                        areaView.style.height = '100%';
                        requestAnimationFrame(() => {
                            this.renderer.renderMapView(this.gameState);
                        });
                    } else {
                        characterView.style.display = 'flex';
                        if (this.clientState.isCharacterPanelCollapsed) {
                            areaView.style.height = 'calc(100% - 84px)';
                        } else {
                            areaView.style.height = '50%';
                        }
                        this.renderer.renderAreaView(this.gameState);
                    }
                    break;
                case 'summon-boss': this.sendCommand('summon-boss'); break;

                case 'toggle-character-panel': {
                    this.clientState.isCharacterPanelCollapsed = !this.clientState.isCharacterPanelCollapsed;
                    const areaViewContainer = document.getElementById('area-view-container');
                    if (this.clientState.isCharacterPanelCollapsed) {
                        areaViewContainer.style.height = 'calc(100% - 84px)';
                    } else {
                        areaViewContainer.style.height = '50%';
                    }
                    this.renderer.toggleCharacterPanel(this.clientState.isCharacterPanelCollapsed);
                    break;
                }

                case 'move-to-tile': {
                    const targetX = parseInt(actionHolder.dataset.x);
                    const targetY = parseInt(actionHolder.dataset.y);
                    this.sendCommand('move', { x: targetX, y: targetY });
                    break;
                }
                case 'move-direction': {
                    const direction = actionHolder.dataset.direction;
                    const { x, y } = this.gameState.player;
                    let targetX = x;
                    let targetY = y;
                    if (direction.includes('up')) targetY = Math.max(0, y - 1);
                    if (direction.includes('down')) targetY = Math.min(19, y + 1);
                    if (direction.includes('left')) targetX = Math.max(0, x - 1);
                    if (direction.includes('right')) targetX = Math.min(19, x + 1);
                    this.sendCommand('move', { x: targetX, y: targetY });
                    break;
                }
            }
        });

        
        // Building modal close button
        document.getElementById('close-building-modal').addEventListener('click', () => {
            document.getElementById('building-modal').classList.add('hidden');
        });
        
        // Close building modal when clicking outside
        document.getElementById('building-modal').addEventListener('click', (e) => {
            if (e.target.id === 'building-modal') {
                document.getElementById('building-modal').classList.add('hidden');
            }
        });
        
        // Teams modal close button
        document.getElementById('close-teams-modal').addEventListener('click', () => {
            document.getElementById('teams-modal').classList.add('hidden');
        });
        
        // Close teams modal when clicking outside
        document.getElementById('teams-modal').addEventListener('click', (e) => {
            if (e.target.id === 'teams-modal') {
                document.getElementById('teams-modal').classList.add('hidden');
            }
        });
        


        document.getElementById('close-enemy-info').addEventListener('click', () => {
            this.dom.modals.enemyInfo.classList.add('hidden');
        });

        // Close enemy info modal when clicking outside
        this.dom.modals.enemyInfo.addEventListener('click', (e) => {
            if (e.target.id === 'enemy-info-modal') {
                this.dom.modals.enemyInfo.classList.add('hidden');
            }
        });
        
        document.getElementById('close-enhancement-modal').addEventListener('click', () => {
            this.dom.modals.enhancement.classList.add('hidden');
        });

        this.dom.modals.enhancement.addEventListener('click', (e) => {
            if (e.target.id === 'enhancement-modal') {
                this.dom.modals.enhancement.classList.add('hidden');
            }
        });

        // Item popup event handlers
        this.dom.itemPopup.closeButton.addEventListener('click', () => {
            this.closeItemPopup();
        });

        // Close item popup when clicking outside
        this.dom.itemPopup.modal.addEventListener('click', (e) => {
            if (e.target === this.dom.itemPopup.modal) {
                this.closeItemPopup();
            }
        });

        // Close item popup with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.dom.itemPopup.modal.classList.contains('hidden')) {
                this.closeItemPopup();
            }
        });
    }






    // Item popup methods
    showItemPopup(item) {
        if (!item) return;
        
        this.dom.itemPopup.title.textContent = "Item Information";
        
        let content = '';
        
        // Basic item info
        content += `<div class="mb-4">
            <div class="text-lg font-semibold text-blue-300 mb-2">${this.renderer.getItemDisplayName(item)}</div>
            <div class="text-sm text-slate-300">${item.description || 'No description available.'}</div>
        </div>`;
        
        // Item type and rarity
        content += `<div class="mb-4">
            <div class="flex justify-between items-center">
                <span class="text-slate-400">Type:</span>
                <span class="text-yellow-400 capitalize">${item.type}</span>
            </div>
            ${item.quality ? `<div class="flex justify-between items-center">
                <span class="text-slate-400">Quality:</span>
                <span class="text-${this.renderer.getQualityColor(item.quality)}">${item.quality}</span>
            </div>` : ''}
            ${item.level ? `<div class="flex justify-between items-center">
                <span class="text-slate-400">Level:</span>
                <span class="text-blue-400">${item.level}</span>
            </div>` : ''}
        </div>`;
        
        // Equipment stats
        if (item.type === 'equipment' && item.stats) {
            content += `<div class="mb-4">
                <div class="text-sm font-semibold text-yellow-400 mb-2">Stats:</div>
                <div class="space-y-1 text-sm">
                    ${item.stats.hp ? `<div class="flex justify-between"><span class="text-slate-400">HP:</span><span class="text-green-400">+${item.stats.hp}</span></div>` : ''}
                    ${item.stats.mp ? `<div class="flex justify-between"><span class="text-slate-400">MP:</span><span class="text-blue-400">+${item.stats.mp}</span></div>` : ''}
                    ${item.stats.dmg ? `<div class="flex justify-between"><span class="text-slate-400">Damage:</span><span class="text-red-400">+${item.stats.dmg}</span></div>` : ''}
                    ${item.stats.speed ? `<div class="flex justify-between"><span class="text-slate-400">Speed:</span><span class="text-purple-400">+${item.stats.speed}</span></div>` : ''}
                    ${item.stats.critical ? `<div class="flex justify-between"><span class="text-slate-400">Critical:</span><span class="text-orange-400">+${item.stats.critical}%</span></div>` : ''}
                    ${item.stats.dodge ? `<div class="flex justify-between"><span class="text-slate-400">Dodge:</span><span class="text-cyan-400">+${item.stats.dodge}%</span></div>` : ''}
                </div>
            </div>`;
        }
        
        // Equipment slot
        if (item.type === 'equipment' && item.slot) {
            content += `<div class="mb-4">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Slot:</span>
                    <span class="text-purple-400 capitalize">${item.slot}</span>
                </div>
            </div>`;
        }

        // Enhancement Slots
        if (item.enhancementSlots !== undefined) {
            content += `<div class="mb-4">
                <div class="text-sm font-semibold text-yellow-400 mb-2">Enhancements:</div>
                <div class="flex items-center gap-2">
                    ${Array(item.enhancementSlots).fill(0).map((_, i) => {
                        const enchantment = item.enchantments && item.enchantments[i];
                        if (enchantment) {
                            return `<div class="w-8 h-8 bg-purple-500 border-2 border-purple-300 rounded-md" title="${enchantment.name}"></div>`;
                        } else {
                            return `<div class="w-8 h-8 bg-slate-700 border-2 border-slate-500 rounded-md"></div>`;
                        }
                    }).join('')}
                </div>
            </div>`;
        }
        
        // Quantity
        if (item.quantity && item.quantity > 1) {
            content += `<div class="mb-4">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Quantity:</span>
                    <span class="text-green-400">${item.quantity}</span>
                </div>
            </div>`;
        }
        
        // Consumable effects
        if (item.type === 'consumable' && item.effects) {
            content += `<div class="mb-4">
                <div class="text-sm font-semibold text-yellow-400 mb-2">Effects:</div>
                <div class="text-sm text-slate-300">${item.effects}</div>
            </div>`;
        }
        
        // Scroll effects
        if (item.type === 'scroll' && item.effects) {
            content += `<div class="mb-4">
                <div class="text-sm font-semibold text-yellow-400 mb-2">Scroll Effects:</div>
                <div class="text-sm text-slate-300">${item.effects}</div>
            </div>`;
        }
        
        this.dom.itemPopup.content.innerHTML = content;
        this.dom.itemPopup.modal.classList.remove('hidden');
    }

    closeItemPopup() {
        this.dom.itemPopup.modal.classList.add('hidden');
    }

    getQualityColor(quality) {
        switch (quality.toLowerCase()) {
            case 'common': return 'gray-400';
            case 'uncommon': return 'green-400';
            case 'rare': return 'blue-400';
            case 'epic': return 'purple-400';
            case 'legendary': return 'orange-400';
            default: return 'gray-400';
        }
    }
}
