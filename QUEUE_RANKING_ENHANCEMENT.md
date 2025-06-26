# 队列排名显示优化

## 概述

对优先级滑块的排名显示进行了两项重要优化，让用户更清晰地理解卡片的排名位置。

## 🎯 优化内容

### 1. 修改总排名显示文案

**修改前：**
```
当前排名：第111名 / 共225张卡片
```

**修改后：**
```
当前总排名：第111名 / 共225张卡片
```

这个修改让用户更明确地知道这是在所有卡片中的总体排名。

### 2. 新增当前队列排名显示

**新增功能：**
```
在 memo 队列中：第5名 / 共15张
```

当用户修改优先级时，现在可以看到：
- **总排名**：在所有卡片中的位置
- **队列排名**：在当前标签（牌组）中的位置

## 🔧 技术实现

### 修改的组件

#### 1. `PrioritySlider.tsx`
- 新增 `currentQueueRank`、`currentQueueSize`、`currentQueueName` props
- 修改显示布局，采用垂直堆叠方式显示两行排名信息
- 总排名使用深色显示，队列排名使用蓝色显示以示区分

#### 2. `PracticeOverlay.tsx`
- 添加队列排名计算逻辑
- 通过 `practiceCardUids` 计算当前卡片在队列中的位置
- 传递队列排名信息给 `PrioritySlider` 组件

### 计算逻辑

```typescript
// 计算当前队列排名信息
const { currentQueueRank, currentQueueSize } = React.useMemo(() => {
  if (!currentCardRefUid || practiceCardUids.length === 0) {
    return { currentQueueRank: undefined, currentQueueSize: undefined };
  }
  
  // 计算当前卡片在当前队列中的位置
  const queueIndex = practiceCardUids.indexOf(currentCardRefUid);
  if (queueIndex === -1) {
    return { currentQueueRank: undefined, currentQueueSize: practiceCardUids.length };
  }
  
  return {
    currentQueueRank: queueIndex + 1, // 排名从1开始
    currentQueueSize: practiceCardUids.length
  };
}, [currentCardRefUid, practiceCardUids]);
```

## 💡 用户体验提升

### 使用场景

用户在复习 `memo` 标签的卡片时看到：

```
优先级排名
(拖动调整排名，关闭窗口时自动保存)

低优先级（第225名）    当前总排名：第111名 / 共225张卡片    高优先级（第1名）
                     在 memo 队列中：第5名 / 共15张
```

### 优势

1. **清晰区分**：用户能区分总体排名和当前队列排名
2. **精确反馈**：当修改优先级时，能准确知道在当前学习队列中的位置
3. **学习指导**：帮助用户理解调整优先级对当前学习计划的影响

## 🎨 界面设计

- **总排名**：使用粗体深色文字 `#2c3e50`
- **队列排名**：使用蓝色文字 `#3498db`，字体稍小
- **布局**：垂直居中对齐，视觉层次清晰

这个优化让用户在调整卡片优先级时有更精确的控制感和反馈感，特别是在多标签混合学习的场景下。 