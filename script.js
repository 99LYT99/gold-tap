// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
vkBridge.send('VKWebAppInit');

function createBgParticles() {
    const container = document.getElementById('bgParticles');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}
createBgParticles();

// ==========================================
// СОСТОЯНИЕ ИГРЫ
// ==========================================
let gameState = {
    score: 0,
    clickPower: 1,
    autoIncome: 0,
    upgrades: {
        clickPower: { level: 0, cost: 50, maxLevel: 50 },
        critChance: { level: 0, cost: 200, maxLevel: 20 },
        critMultiplier: { level: 0, cost: 500, maxLevel: 15 },
        comboDuration: { level: 0, cost: 300, maxLevel: 10 },
        autoIncome: { level: 0, cost: 100, maxLevel: 30 },
        autoIncomeMultiplier: { level: 0, cost: 1000, maxLevel: 20 }
    }
};

let comboState = {
    count: 0,
    multiplier: 1,
    lastTapTime: 0,
    comboTimeout: null,
    barTimeout: null
};

let saveTimeout = null;
let currentUser = null;
let currentTab = 'basic';

// ==========================================
// ЭЛЕМЕНТЫ DOM
// ==========================================
const scoreEl = document.getElementById('score');
const incomeEl = document.getElementById('income');
const tapBtn = document.getElementById('tapBtn');
const adBtn = document.getElementById('adBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const leaderboardModal = document.getElementById('leaderboardModal');
const upgradeModal = document.getElementById('upgradeModal');
const closeModal = document.getElementById('closeModal');
const closeUpgradeModal = document.getElementById('closeUpgradeModal');
const leaderboardList = document.getElementById('leaderboardList');
const upgradeList = document.getElementById('upgradeList');
const comboIndicator = document.getElementById('comboIndicator');
const comboMultiplierEl = document.getElementById('comboMultiplier');
const comboBarFill = document.getElementById('comboBarFill');
const critChanceEl = document.getElementById('critChance');
const comboDurationEl = document.getElementById('comboDuration');

// ==========================================
// 🔊 ЗВУКОВАЯ СИСТЕМА
// ==========================================
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Аудио не поддерживается');
        }
    }
}

function playCoinSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const frequencies = [523.25, 659.25, 783.99];
    
    frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(freq, now);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now + index * 0.02);
        oscillator.stop(now + 0.3);
    });
}

function playCritSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    
    const bassOsc = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bassOsc.connect(bassGain);
    bassGain.connect(audioContext.destination);
    bassOsc.frequency.setValueAtTime(150, now);
    bassOsc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    bassOsc.type = 'sawtooth';
    bassGain.gain.setValueAtTime(0.3, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    bassOsc.start(now);
    bassOsc.stop(now + 0.3);
    
    const frequencies = [783.99, 987.77, 1174.66];
    frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(freq, now);
        oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        oscillator.start(now + index * 0.03);
        oscillator.stop(now + 0.4);
    });
}

function playComboSound(comboLevel) {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const baseFreq = 400 + (comboLevel * 50);
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(baseFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
}

function playUpgradeSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.3);
    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    oscillator.type = 'triangle';
    oscillator.start(now);
    oscillator.stop(now + 0.3);
}

// ==========================================
// ✨ АНИМАЦИЯ
// ==========================================
function createFlyingNumber(x, y, value, type = 'normal') {
    const number = document.createElement('div');
    number.className = `flying-number ${type}`;
    let prefix = '+';
    if (type === 'crit') prefix = '💥 КРИТ! +';
    number.textContent = prefix + value;
    number.style.left = x + 'px';
    number.style.top = y + 'px';
    document.body.appendChild(number);
    setTimeout(() => number.remove(), type === 'crit' ? 1200 : 1000);
}

// ==========================================
// 🎯 КОМБО
// ==========================================
function getComboDuration() {
    return 2 + (gameState.upgrades.comboDuration.level * 0.5);
}

function updateCombo() {
    const now = Date.now();
    const timeSinceLastTap = now - comboState.lastTapTime;
    const comboDuration = getComboDuration() * 1000;
    
    if (timeSinceLastTap < 500 && comboState.lastTapTime > 0) {
        comboState.count++;
        if (comboState.count % 5 === 0) {
            comboState.multiplier = Math.min(5, 1 + Math.floor(comboState.count / 5));
            playComboSound(comboState.multiplier);
        }
    } else {
        comboState.count = 0;
        comboState.multiplier = 1;
    }
    
    comboState.lastTapTime = now;
    
    if (comboState.multiplier > 1) {
        comboIndicator.classList.remove('hidden');
        comboIndicator.classList.add('active');
        comboMultiplierEl.textContent = comboState.multiplier;
        setTimeout(() => comboIndicator.classList.remove('active'), 500);
        comboBarFill.style.width = '100%';
        clearTimeout(comboState.barTimeout);
        comboState.barTimeout = setTimeout(() => {
            comboBarFill.style.width = '0%';
        }, 500);
    }
    
    clearTimeout(comboState.comboTimeout);
    comboState.comboTimeout = setTimeout(() => {
        comboState.count = 0;
        comboState.multiplier = 1;
        comboIndicator.classList.add('hidden');
    }, comboDuration);
}

// ==========================================
// 💾 СОХРАНЕНИЕ
// ==========================================
function saveGame() {
    localStorage.setItem('gameState', JSON.stringify(gameState));
    vkBridge.send('VKWebAppStorageSet', {
        key: 'game_save',
        value: JSON.stringify(gameState)
    }).catch(err => console.log('Ошибка сохранения в ВК:', err));
}

function loadGame() {
    return new Promise((resolve) => {
        vkBridge.send('VKWebAppStorageGet', { keys: ['game_save'] })
            .then(data => {
                const saved = data.keys.find(k => k.key === 'game_save');
                if (saved && saved.value) {
                    try {
                        const loaded = JSON.parse(saved.value);
                        gameState = { ...gameState, ...loaded };
                        if (!gameState.upgrades) {
                            gameState.upgrades = {
                                clickPower: { level: 0, cost: 50, maxLevel: 50 },
                                critChance: { level: 0, cost: 200, maxLevel: 20 },
                                critMultiplier: { level: 0, cost: 500, maxLevel: 15 },
                                comboDuration: { level: 0, cost: 300, maxLevel: 10 },
                                autoIncome: { level: 0, cost: 100, maxLevel: 30 },
                                autoIncomeMultiplier: { level: 0, cost: 1000, maxLevel: 20 }
                            };
                        }
                    } catch (e) {}
                }
                resolve();
            })
            .catch(err => {
                const localSave = localStorage.getItem('gameState');
                if (localSave) {
                    try {
                        gameState = { ...gameState, ...JSON.parse(localSave) };
                    } catch (e) {}
                }
                resolve();
            });
    });
}

setInterval(saveGame, 10000);

// ==========================================
// UI
// ==========================================
function updateUI() {
    scoreEl.textContent = Math.floor(gameState.score).toLocaleString('ru-RU');
    incomeEl.textContent = gameState.autoIncome;
    
    const critChance = 10 + (gameState.upgrades.critChance.level * 2);
    critChanceEl.textContent = critChance;
    
    const comboDuration = getComboDuration();
    comboDurationEl.textContent = comboDuration.toFixed(1);
    
    if (currentTab && !upgradeModal.classList.contains('hidden')) {
        renderUpgrades();
    }
}

// ==========================================
// 🎮 ТАП
// ==========================================
tapBtn.addEventListener('click', (e) => {
    initAudio();
    updateCombo();
    
    let damage = gameState.clickPower * comboState.multiplier;
    let isCrit = false;
    
    const critChance = (10 + (gameState.upgrades.critChance.level * 2)) / 100;
    if (Math.random() < critChance) {
        const critMult = 5 + (gameState.upgrades.critMultiplier.level * 1);
        damage *= critMult;
        isCrit = true;
        playCritSound();
    } else {
        playCoinSound();
    }
    
    gameState.score += damage;
    
    const rect = tapBtn.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
    const y = rect.top + rect.height / 3;
    
    const type = isCrit ? 'crit' : (comboState.multiplier > 1 ? 'combo' : 'normal');
    createFlyingNumber(x, y, Math.floor(damage), type);
    
    updateUI();
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveGame, 1000);
});

// ==========================================
// 🛠 ПРОКАЧКА
// ==========================================
upgradeBtn.addEventListener('click', () => {
    upgradeModal.classList.remove('hidden');
    renderUpgrades();
});

closeUpgradeModal.addEventListener('click', () => {
    upgradeModal.classList.add('hidden');
});

upgradeModal.addEventListener('click', (e) => {
    if (e.target === upgradeModal) {
        upgradeModal.classList.add('hidden');
    }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderUpgrades();
    });
});

function renderUpgrades() {
    upgradeList.innerHTML = '';
    
    const upgrades = {
        basic: [
            {
                id: 'clickPower',
                name: '⚒️ Сила тапа',
                desc: 'Увеличивает золото за каждый тап',
                effect: (level) => `+${level + 1} к силе тапа`
            }
        ],
        crit: [
            {
                id: 'critChance',
                name: '💥 Шанс крита',
                desc: 'Увеличивает шанс критического удара',
                effect: (level) => `${10 + (level + 1) * 2}% шанс крита`
            },
            {
                id: 'critMultiplier',
                name: '⚡ Сила крита',
                desc: 'Увеличивает множитель критического удара',
                effect: (level) => `x${5 + (level + 1)} урон при крите`
            }
        ],
        combo: [
            {
                id: 'comboDuration',
                name: '⏱️ Длительность комбо',
                desc: 'Увеличивает время действия комбо',
                effect: (level) => `${(2 + (level + 1) * 0.5).toFixed(1)}с комбо`
            }
        ],
        passive: [
            {
                id: 'autoIncome',
                name: '💎 Пассивный доход',
                desc: 'Золото добывается автоматически',
                effect: (level) => `+${level + 1} золота/сек`
            },
            {
                id: 'autoIncomeMultiplier',
                name: '📈 Множитель пассива',
                desc: 'Увеличивает пассивный доход',
                effect: (level) => `x${1 + (level + 1) * 0.5} к пассиву`
            }
        ]
    };
    
    const currentUpgrades = upgrades[currentTab];
    
    currentUpgrades.forEach(upg => {
        const data = gameState.upgrades[upg.id];
        const isMaxed = data.level >= data.maxLevel;
        const canAfford = gameState.score >= data.cost;
        
        const item = document.createElement('div');
        item.className = `upgrade-item ${isMaxed ? 'maxed' : ''} ${!canAfford && !isMaxed ? 'disabled' : ''}`;
        
        item.innerHTML = `
            <div class="upgrade-header">
                <div class="upgrade-name">${upg.name}</div>
                <div class="upgrade-level">Ур. ${data.level}/${data.maxLevel}</div>
            </div>
            <div class="upgrade-desc">${upg.desc}</div>
            <div class="upgrade-desc" style="color:#00e5ff">Следующий: ${isMaxed ? 'МАКС' : upg.effect(data.level)}</div>
            <div class="upgrade-cost">${isMaxed ? '✅ МАКСИМУМ' : `Цена: ${data.cost.toLocaleString('ru-RU')} 🪙`}</div>
        `;
        
        if (!isMaxed && canAfford) {
            item.addEventListener('click', () => buyUpgrade(upg.id));
        }
        
        upgradeList.appendChild(item);
    });
}

function buyUpgrade(upgradeId) {
    const data = gameState.upgrades[upgradeId];
    
    if (gameState.score >= data.cost && data.level < data.maxLevel) {
        gameState.score -= data.cost;
        data.level++;
        data.cost = Math.floor(data.cost * 1.5);
        
        // Применяем эффекты
        if (upgradeId === 'clickPower') {
            gameState.clickPower = 1 + data.level;
        } else if (upgradeId === 'autoIncome') {
            gameState.autoIncome = data.level;
        }
        
        initAudio();
        playUpgradeSound();
        updateUI();
        saveGame();
    }
}

// ==========================================
// 🎬 РЕКЛАМА
// ==========================================
adBtn.addEventListener('click', () => {
    initAudio();
    
    vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' })
        .then(data => {
            if (data.result) {
                return vkBridge.send('VKWebAppShowNativeAds', { 
                    ad_format: 'reward', 
                    use_waterfall: true 
                });
            } else {
                alert('Реклама загружается. Попробуйте через минуту!');
                return Promise.reject();
            }
        })
        .then(data => {
            if (data && data.result) {
                let bonus = Math.max(100, Math.floor(gameState.score * 0.5) + gameState.clickPower * 50);
                gameState.score += bonus;
                playCoinSound();
                alert(`🎉 +${bonus.toLocaleString('ru-RU')} золота!`);
                updateUI();
                saveGame();
            }
        })
        .catch(err => console.log('Ошибка рекламы:', err));
});

// ==========================================
// 🏆 ЛИДЕРБОРД
// ==========================================
leaderboardBtn.addEventListener('click', () => {
    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = '<div class="loading">Загрузка...</div>';
    loadLeaderboard();
});

closeModal.addEventListener('click', () => {
    leaderboardModal.classList.add('hidden');
});

leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) {
        leaderboardModal.classList.add('hidden');
    }
});

async function loadLeaderboard() {
    try {
        const userResult = await vkBridge.send('VKWebAppGetUserInfo');
        currentUser = userResult;
        
        try {
            const leaderboardData = await vkBridge.send('VKWebAppCallAPIMethod', {
                method: 'apps.getLeaderboard',
                params: {
                    type: 'level',
                    global: 0
                }
            });
            
            if (leaderboardData.response && leaderboardData.response.items) {
                renderLeaderboard(leaderboardData.response.items);
                return;
            }
        } catch (apiErr) {
            console.log('API лидерборда недоступен');
        }
        
        const friendsResult = await vkBridge.send('VKWebAppGetFriends');
        if (friendsResult && friendsResult.users) {
            renderFriendsList(friendsResult.users);
        } else {
            leaderboardList.innerHTML = '<div class="loading">Лидерборд будет доступен после публикации игры в ВК</div>';
        }
        
    } catch (err) {
        console.log('Ошибка загрузки лидерборда:', err);
        leaderboardList.innerHTML = '<div class="loading">Не удалось загрузить таблицу</div>';
    }
}

function renderLeaderboard(items) {
    leaderboardList.innerHTML = '';
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'leader-item';
        if (currentUser && item.id === currentUser.id) {
            div.classList.add('current-user');
        }
        
        const posClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        
        div.innerHTML = `
            <div class="leader-position ${posClass}">${index + 1}</div>
            <div class="leader-name">${item.user.first_name} ${item.user.last_name}</div>
            <div class="leader-score">${item.score.toLocaleString('ru-RU')} 🪙</div>
        `;
        
        leaderboardList.appendChild(div);
    });
    
    if (items.length === 0) {
        leaderboardList.innerHTML = '<div class="loading">Пока нет результатов. Будь первым!</div>';
    }
}

function renderFriendsList(friends) {
    leaderboardList.innerHTML = '<div class="loading" style="color:#ffd700">👥 Твои друзья ВК</div>';
    
    if (currentUser) {
        const div = document.createElement('div');
        div.className = 'leader-item current-user';
        div.innerHTML = `
            <div class="leader-position gold">⭐</div>
            <div class="leader-name">${currentUser.first_name} (ты)</div>
            <div class="leader-score">${Math.floor(gameState.score).toLocaleString('ru-RU')} 🪙</div>
        `;
        leaderboardList.appendChild(div);
    }
    
    friends.slice(0, 20).forEach(friend => {
        const div = document.createElement('div');
        div.className = 'leader-item';
        div.innerHTML = `
            <div class="leader-position">—</div>
            <div class="leader-name">${friend.first_name} ${friend.last_name}</div>
            <div class="leader-score" style="color:#999">???</div>
        `;
        leaderboardList.appendChild(div);
    });
    
    const note = document.createElement('div');
    note.className = 'loading';
    note.style.fontSize = '12px';
    note.style.marginTop = '15px';
    note.textContent = '💡 После публикации игры здесь будут реальные результаты друзей';
    leaderboardList.appendChild(note);
}

// ==========================================
// 💤 ПАССИВНЫЙ ДОХОД
// ==========================================
setInterval(() => {
    if (gameState.autoIncome > 0) {
        gameState.score += gameState.autoIncome;
        updateUI();
    }
}, 1000);

// ==========================================
// 🚀 СТАРТ
// ==========================================
loadGame().then(() => {
    updateUI();
    console.log('🎮 Игра запущена!');
});

window.addEventListener('beforeunload', saveGame);