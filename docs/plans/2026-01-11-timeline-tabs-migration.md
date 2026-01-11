# Timeline Tabs Migration - Exact Copy from Web Version

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Перенести точную копию Timeline Tab из веб-версии (Bloodborne.tsx) в desktop версию (App.tsx) со всеми стилями, анимациями и функциональностью.

**Architecture:** Добавить недостающие state переменные в desktop, затем заменить весь Timeline Tab блок на точную копию из веб-версии с минимальными адаптациями для совместимости.

**Tech Stack:** React, TypeScript, Framer Motion, Tailwind CSS

---

## Анализ различий

### State переменные

| Web Version | Desktop Version | Action |
|-------------|-----------------|--------|
| `editBossName` | `editBossForm.name` | Добавить отдельные переменные |
| `editBossDeaths` | `editBossForm.deaths` | Добавить отдельные переменные |
| `editBossSegments` | отсутствует | Добавить |
| `expandedBoss` | отсутствует | Добавить |
| `expandedAttempts` | отсутствует | Добавить |
| `editMilestoneName` | `editMilestoneForm.name` | Добавить отдельные переменные |
| `editMilestoneIcon` | `editMilestoneForm.icon` | Добавить отдельные переменные |
| `editMilestoneTime` | отсутствует | Добавить |
| `editStatsTime` | отсутствует | Добавить |

### Карточки для переноса

1. **Boss Card** - полная карточка с редактированием сегментов
2. **Boss Start Marker** - маркер начала боя
3. **Boss Pause Marker** - маркер паузы
4. **Boss Resume Marker** - маркер возобновления
5. **Milestone Card** - карточка вехи
6. **Stats Card** - карточка характеристик
7. **Death Card** - карточка смерти

---

## Task 1: Добавить недостающие state переменные

**Files:**
- Modify: `src/App.tsx:185-202`

**Step 1: Найти текущие state переменные для редактирования**

Текущий код (строки 185-202):
```typescript
const [editingBoss, setEditingBoss] = useState<string | null>(null)
const [editBossForm, setEditBossForm] = useState({ name: '', deaths: 0 })

const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
const [editMilestoneForm, setEditMilestoneForm] = useState({ name: '', icon: '★' })

const [editingStats, setEditingStats] = useState<string | null>(null)
const [editStatsForm, setEditStatsForm] = useState({...})

const [editingDeathIndex, setEditingDeathIndex] = useState<number | null>(null)
const [editDeathTime, setEditDeathTime] = useState('')
```

**Step 2: Заменить на веб-версию state переменных**

```typescript
// Boss editing state (web version style)
const [editingBoss, setEditingBoss] = useState<string | null>(null)
const [editBossName, setEditBossName] = useState('')
const [editBossDeaths, setEditBossDeaths] = useState('')
const [editBossSegments, setEditBossSegments] = useState<{ start: string, end: string }[]>([])
const [expandedBoss, setExpandedBoss] = useState<string | null>(null)
const [expandedAttempts, setExpandedAttempts] = useState<string | null>(null)

// Milestone editing state (web version style)
const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
const [editMilestoneName, setEditMilestoneName] = useState('')
const [editMilestoneIcon, setEditMilestoneIcon] = useState('')
const [editMilestoneTime, setEditMilestoneTime] = useState('')

// Stats editing state (web version style)
const [editingStats, setEditingStats] = useState<string | null>(null)
const [editStatsTime, setEditStatsTime] = useState('')

// Death editing state
const [editingDeathIndex, setEditingDeathIndex] = useState<number | null>(null)
const [editDeathTime, setEditDeathTime] = useState('')
```

**Step 3: Удалить старые form объекты**

Удалить:
- `editBossForm`, `setEditBossForm`
- `editMilestoneForm`, `setEditMilestoneForm`
- `editStatsForm`, `setEditStatsForm`

**Step 4: Проверить сборку**

Run: `npm run build 2>&1 | head -50`
Expected: Ошибки компиляции (ссылки на старые переменные) - это ожидаемо, исправим в следующих задачах

---

## Task 2: Обновить handler функции для Boss

**Files:**
- Modify: `src/App.tsx` - функции handleEditBoss, handleSaveBoss

**Step 1: Найти текущие handler функции**

Искать: `handleEditBoss`, `handleSaveBoss`

**Step 2: Обновить handleEditBoss**

```typescript
const handleEditBoss = (id: string) => {
  const boss = state.bossFights.find(b => b.id === id)
  if (boss) {
    setEditingBoss(id)
    setEditBossName(boss.name)
    setEditBossDeaths(boss.deathsOnBoss.toString())
    // Initialize segments for editing
    if (boss.segments && boss.segments.length > 0) {
      setEditBossSegments(boss.segments.map(seg => ({
        start: formatTime(seg.start),
        end: formatTime(seg.end)
      })))
    } else {
      setEditBossSegments([{ start: formatTime(boss.startTime), end: formatTime(boss.endTime) }])
    }
  }
}
```

**Step 3: Обновить handleSaveBoss**

```typescript
const handleSaveBoss = () => {
  if (!editingBoss) return
  const deaths = editBossDeaths ? parseInt(editBossDeaths) : undefined
  // Parse segments
  const segments = editBossSegments.map(seg => ({
    start: parseTimeInput(seg.start),
    end: parseTimeInput(seg.end)
  })).filter(seg => seg.start >= 0 && seg.end > seg.start)
  // Calculate startTime and endTime from segments
  const startMs = segments.length > 0 ? segments[0].start : undefined
  const endMs = segments.length > 0 ? segments[segments.length - 1].end : undefined

  // Send to WebSocket
  send({
    type: 'bb-edit-boss',
    id: editingBoss,
    name: editBossName.trim(),
    deaths,
    startTime: startMs,
    endTime: endMs,
    segments: segments.length > 0 ? segments : undefined
  })

  // Reset state
  setEditingBoss(null)
  setEditBossName('')
  setEditBossDeaths('')
  setEditBossSegments([])
}
```

---

## Task 3: Обновить handler функции для Milestone

**Files:**
- Modify: `src/App.tsx` - функции handleEditMilestone, handleSaveMilestone

**Step 1: Обновить handleEditMilestone**

```typescript
const handleEditMilestone = (id: string) => {
  const milestone = state.milestones.find(m => m.id === id)
  if (milestone) {
    setEditingMilestone(id)
    setEditMilestoneName(milestone.name)
    setEditMilestoneIcon(milestone.icon)
    setEditMilestoneTime(formatTime(milestone.timestamp))
  }
}
```

**Step 2: Обновить handleSaveMilestone**

```typescript
const handleSaveMilestone = () => {
  if (!editingMilestone) return
  const timestamp = editMilestoneTime ? parseTimeInput(editMilestoneTime) : undefined

  send({
    type: 'bb-edit-milestone',
    id: editingMilestone,
    name: editMilestoneName.trim(),
    icon: editMilestoneIcon,
    timestamp
  })

  setEditingMilestone(null)
  setEditMilestoneName('')
  setEditMilestoneIcon('')
  setEditMilestoneTime('')
}
```

---

## Task 4: Обновить handler функции для Stats

**Files:**
- Modify: `src/App.tsx` - функции handleEditStats, handleSaveStats

**Step 1: Обновить handleEditStats**

```typescript
const handleEditStats = (id: string) => {
  const stats = state.characterStats.find(s => s.id === id)
  if (stats) {
    setEditingStats(id)
    setEditStatsTime(formatTime(stats.timestamp))
  }
}
```

**Step 2: Обновить handleSaveStats для использования DOM**

Stats редактирование использует DOM getElementById для получения значений (как в веб версии):

```typescript
const handleSaveStats = () => {
  if (!editingStats) return
  const getVal = (key: string) => {
    const el = document.getElementById(`edit-stats-${editingStats}-${key}`) as HTMLInputElement
    return key === 'notes' ? el?.value : parseInt(el?.value || '0')
  }
  const timestamp = editStatsTime ? parseTimeInput(editStatsTime) : undefined

  send({
    type: 'bb-edit-stats',
    id: editingStats,
    level: getVal('level') as number,
    vitality: getVal('vitality') as number,
    endurance: getVal('endurance') as number,
    strength: getVal('strength') as number,
    skill: getVal('skill') as number,
    bloodtinge: getVal('bloodtinge') as number,
    arcane: getVal('arcane') as number,
    bloodEchoes: getVal('bloodEchoes') as number,
    insight: getVal('insight') as number,
    notes: getVal('notes') as string,
    timestamp
  })

  setEditingStats(null)
  setEditStatsTime('')
}
```

---

## Task 5: Скопировать Timeline Tab - Boss Card

**Files:**
- Modify: `src/App.tsx:1534-1624` (текущий boss card)
- Reference: `cinesync-app/src/pages/Bloodborne.tsx:2797-3218`

**Step 1: Заменить Boss Card на точную копию из веб-версии**

Заменить весь блок `if (event.type === 'boss')` на код из веб-версии (строки 2797-3218), включая:
- Редактирование сегментов
- Раскрывающийся список сегментов (expandedBoss)
- Раскрывающийся список попыток (expandedAttempts)
- Точные стили кнопок с `min-h-[40px]`

---

## Task 6: Скопировать Timeline Tab - Boss Markers

**Files:**
- Modify: `src/App.tsx:1625-1651` (boss_start, boss_pause, boss_resume)
- Reference: `cinesync-app/src/pages/Bloodborne.tsx:3220-3315`

**Step 1: Заменить boss_start marker**

Веб-версия имеет:
- `className="relative overflow-hidden"`
- Градиентный фон: `linear-gradient(135deg, ${COLORS.bossAmber}10 0%, ${COLORS.bossAmberDark}05 100%)`
- Внутренний div с `p-2 pl-3`

**Step 2: Заменить boss_pause marker**

**Step 3: Заменить boss_resume marker**

---

## Task 7: Скопировать Timeline Tab - Milestone Card

**Files:**
- Modify: `src/App.tsx:1652-1737` (milestone card)
- Reference: `cinesync-app/src/pages/Bloodborne.tsx:3317-3498`

**Step 1: Заменить Milestone Card на точную копию**

Включая:
- Редактирование времени (editMilestoneTime)
- Icon picker
- Точные стили кнопок

---

## Task 8: Скопировать Timeline Tab - Stats Card

**Files:**
- Modify: `src/App.tsx:1739-1978` (stats card)
- Reference: `cinesync-app/src/pages/Bloodborne.tsx:3501-3724`

**Step 1: Заменить Stats Card на точную копию**

Включая:
- Grid 4 колонки для характеристик
- Редактирование времени (editStatsTime)
- ID атрибуты для input полей (`edit-stats-${s.id}-${key}`)

---

## Task 9: Скопировать Timeline Tab - Death Card

**Files:**
- Modify: `src/App.tsx:1980-2099` (death card)
- Reference: `cinesync-app/src/pages/Bloodborne.tsx:3726-3854`

**Step 1: Заменить Death Card на точную копию**

Уже почти идентичен, проверить:
- Переменные `deathIndex` и `timestamp` вместо `event.index` и `event.time`
- onClick для edit button устанавливает `formatTime(timestamp)`

---

## Task 10: Финальная проверка и сборка

**Step 1: Проверить TypeScript сборку**

Run: `npm run build 2>&1`
Expected: Успешная сборка без ошибок

**Step 2: Запустить приложение**

Run: `PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" npm run tauri dev`

**Step 3: Визуальная проверка**

- [ ] Boss карточки выглядят идентично веб-версии
- [ ] Редактирование сегментов работает
- [ ] Milestone карточки выглядят идентично
- [ ] Stats карточки с 4-колоночным grid
- [ ] Death карточки с правильными отступами
- [ ] Все анимации работают (spring, scale, opacity)
- [ ] Hover эффекты работают

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: migrate Timeline Tab exact copy from web version

- Add missing state variables (editBossSegments, expandedBoss, etc.)
- Update handler functions to match web version
- Copy exact card styles, animations, and fonts
- Add segment editing for boss fights
- Add collapsible segments and attempts lists

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Источники

- **Web Version:** `/Users/warezzko/Desktop/netfl/cinesync-app/src/pages/Bloodborne.tsx`
  - Timeline section: lines 2760-3855
  - State variables: lines 339-373

- **Desktop Version:** `/Users/warezzko/Desktop/netfl/bb-tracker-desktop/src/App.tsx`
  - Timeline Tab: lines 1530-2106
  - State variables: lines 185-202
