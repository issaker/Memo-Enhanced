import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import useBlockInfo from '~/hooks/useBlockInfo';
import * as asyncUtils from '~/utils/async';
import * as dateUtils from '~/utils/date';
import * as stringUtils from '~/utils/string';
import Lottie from 'react-lottie';
import doneAnimationData from '~/lotties/done.json';
import Tooltip from '~/components/Tooltip';
import mediaQueries from '~/utils/mediaQueries';
import { useZIndexFix } from '~/hooks/useZIndexFix';
import { useFocusFix } from '~/hooks/useFocusFix';

import CardBlock from '~/components/overlay/CardBlock';
import Footer from '~/components/overlay/Footer';
import PrioritySlider from '~/components/overlay/PrioritySlider';
import ButtonTags from '~/components/ButtonTags';
import { CompleteRecords, IntervalMultiplierType, ReviewModes } from '~/models/session';
import useCurrentCardData from '~/hooks/useCurrentCardData';
import { generateNewSession } from '~/queries';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';
import { bulkSaveRankingChanges, getCardRank } from '~/queries/save';

interface MainContextProps {
  reviewMode: ReviewModes | undefined;
  setReviewModeOverride: React.Dispatch<React.SetStateAction<ReviewModes | undefined>>;
  intervalMultiplier: number;
  setIntervalMultiplier: (multiplier: number) => void;
  intervalMultiplierType: IntervalMultiplierType;
  setIntervalMultiplierType: (type: IntervalMultiplierType) => void;
  onPracticeClick: (props: handlePracticeProps) => void;
  today: Today;
  selectedTag: string;
  currentIndex: number;
  renderMode: RenderMode;
  setRenderMode: (tag: string, mode: RenderMode) => void;
}

export const MainContext = React.createContext<MainContextProps>({} as MainContextProps);

interface Props {
  isOpen: boolean;
  tagsList: string[];
  selectedTag: string;
  onCloseCallback: () => void;
  practiceData: CompleteRecords;
  today: Today;
  handlePracticeClick: (props: handlePracticeProps) => void;
  handleMemoTagChange: (tag: string) => void;
  handleReviewMoreClick: () => void;
  isCramming: boolean;
  setIsCramming: (isCramming: boolean) => void;
  rtlEnabled: boolean;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  dataPageTitle: string;
  onDataRefresh: () => void;
  allCardsCount: number;
  priorityOrder: string[];
  allCardUids: string[];
  defaultPriority: number;
}

const PracticeOverlay = ({
  isOpen,
  tagsList,
  selectedTag,
  onCloseCallback,
  practiceData,
  today,
  handlePracticeClick,
  handleMemoTagChange,
  handleReviewMoreClick,
  isCramming,
  setIsCramming,
  rtlEnabled,
  setRenderMode,
  dataPageTitle,
  onDataRefresh,
  allCardsCount,
  priorityOrder,
  allCardUids,
  defaultPriority,
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag];
  const newCardsUids = todaySelectedTag.newUids;
  const dueCardsUids = todaySelectedTag.dueUids;
  const practiceCardUids = [...dueCardsUids, ...newCardsUids];
  const renderMode = todaySelectedTag.renderMode;

  const [currentIndex, setCurrentIndex] = React.useState(0);

  const isFirst = currentIndex === 0;
  const completedTodayCount = todaySelectedTag.completed;

  const currentCardRefUid = practiceCardUids[currentIndex] as string | undefined;

  const sessions = React.useMemo(() => {
    const sessions = currentCardRefUid ? practiceData[currentCardRefUid] : [];
    if (!sessions) return [];
    return sessions;
  }, [currentCardRefUid, practiceData]);
  const { currentCardData, reviewMode, setReviewModeOverride } = useCurrentCardData({
    currentCardRefUid,
    sessions,
  });

  const totalCardsCount = todaySelectedTag.new + todaySelectedTag.due;
  const hasCards = totalCardsCount > 0;
  
  // 🚀 FIXED: 完成状态检查 - 使用简单的逻辑避免循环依赖
  const isDone = todaySelectedTag.status === CompletionStatus.Finished || !currentCardData;

  const newFixedSessionDefaults = React.useMemo(
    () => generateNewSession({ reviewMode: ReviewModes.FixedInterval }),
    []
  );
  const [intervalMultiplier, setIntervalMultiplier] = React.useState<number>(
    currentCardData?.intervalMultiplier || (newFixedSessionDefaults.intervalMultiplier as number)
  );
  const [intervalMultiplierType, setIntervalMultiplierType] =
    React.useState<IntervalMultiplierType>(
      currentCardData?.intervalMultiplierType ||
        (newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType)
    );

  // 🎯 协同排名系统状态管理
  const [rankingChanges, setRankingChanges] = React.useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  
  // 🎯 获取当前卡片的排名（从协同排名列表中计算）
  const currentCardRank = React.useMemo(() => {
    if (!currentCardRefUid) {
      // 🎯 FIXED: 没有卡片时，使用默认优先级计算位置
      const defaultRank = Math.max(1, Math.ceil(allCardsCount * (1 - defaultPriority / 100)));
      return defaultRank;
    }
    
    // 首先检查是否有本地未保存的变更
    if (rankingChanges[currentCardRefUid] !== undefined) {
      return rankingChanges[currentCardRefUid];
    }
    
    // 🚀 FIXED: 完全依赖priorityOrder作为唯一数据源
    const index = priorityOrder.indexOf(currentCardRefUid);
    
    if (index === -1) {
      // 🚀 FIXED: 如果卡片不在priorityOrder中，说明预填充失败，记录错误
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [排名计算] 卡片不在priorityOrder中，预填充可能失败:', currentCardRefUid);
      }
      return 1; // 返回最高优先级作为安全备用
    }
    
    // 🚀 正常情况：使用在排名列表中的位置
    const rank = index + 1; // 排名从1开始
    return rank;
  }, [currentCardRefUid, priorityOrder, allCardsCount, rankingChanges, defaultPriority]);

  // 🚀 DEBUG: 添加调试信息 (仅在开发环境)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 [排名计算] 当前卡片:', currentCardRefUid);
      console.log('🎯 [排名计算] priorityOrder:', priorityOrder);
      console.log('🎯 [排名计算] 计算排名:', currentCardRank);
    }
  }, [currentCardRefUid, priorityOrder, currentCardRank]);

  // 处理排名变更 - 只更新本地状态，不立即保存
  const handleRankingChange = React.useCallback((newRank: number) => {
    if (!currentCardRefUid) return;
    
    setRankingChanges(prev => ({
      ...prev,
      [currentCardRefUid]: newRank
    }));
    
    setHasUnsavedChanges(true);
  }, [currentCardRefUid]);

  // When card changes, update multiplier state
  React.useEffect(() => {
    if (!currentCardData) return;

    if (currentCardData?.reviewMode === ReviewModes.FixedInterval) {
      // If card has multiplier, use that
      setIntervalMultiplier(currentCardData.intervalMultiplier as number);
      setIntervalMultiplierType(currentCardData.intervalMultiplierType as IntervalMultiplierType);
    } else {
      // Otherwise, just reset to default
      setIntervalMultiplier(newFixedSessionDefaults.intervalMultiplier as number);
      setIntervalMultiplierType(
        newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType
      );
    }
  }, [currentCardData, newFixedSessionDefaults]);

  const hasNextDueDate = currentCardData && 'nextDueDate' in currentCardData;
  const isNew = currentCardData && 'isNew' in currentCardData && currentCardData.isNew;
  const nextDueDate = hasNextDueDate ? currentCardData.nextDueDate : undefined;

  const isDueToday = dateUtils.daysBetween(nextDueDate, new Date()) === 0;
  const status = isNew ? 'new' : isDueToday ? 'dueToday' : hasNextDueDate ? 'pastDue' : null;

  const { blockInfo, isLoading: blockInfoLoading, refreshBlockInfo } = useBlockInfo({ refUid: currentCardRefUid });
  const hasBlockChildren = !!blockInfo.children && !!blockInfo.children.length;
  const hasBlockChildrenUids = !!blockInfo.childrenUids && !!blockInfo.childrenUids.length;

  const [showAnswers, setShowAnswers] = React.useState(false);
  const [hasCloze, setHasCloze] = React.useState(true);

  const shouldShowAnswerFirst =
    renderMode === RenderMode.AnswerFirst && hasBlockChildrenUids && !showAnswers;

  // 🎯 FIXED: 改进showAnswers状态管理，处理子块被删除的情况
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [ShowAnswers] 状态检查:', {
        currentCardRefUid,
        hasBlockChildren,
        hasBlockChildrenUids,
        hasCloze,
        '子块数量': blockInfo.children?.length || 0
      });
    }

    // 如果既没有子块也没有cloze，直接显示评分按钮
    if (!hasBlockChildren && !hasBlockChildrenUids && !hasCloze) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [ShowAnswers] 无子块无cloze，直接显示评分按钮');
      }
      setShowAnswers(true);
    } 
    // 如果有子块或cloze，隐藏答案，显示Show Answer按钮
    else if (hasBlockChildren || hasBlockChildrenUids || hasCloze) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [ShowAnswers] 有子块或cloze，隐藏答案');
      }
      setShowAnswers(false);
    }
    // 边界情况：如果状态不明确，刷新block信息
    else {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [ShowAnswers] 状态不明确，刷新block信息');
      }
      refreshBlockInfo();
    }
  }, [hasBlockChildren, hasBlockChildrenUids, hasCloze, currentIndex, currentCardRefUid, refreshBlockInfo, blockInfo.children?.length]);

  // 🎯 NEW: 当卡片切换时，强制刷新block信息以确保获取最新状态
  React.useEffect(() => {
    if (currentCardRefUid) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [BlockInfo] 卡片切换，刷新block信息:', currentCardRefUid);
      }
      refreshBlockInfo();
    }
  }, [currentCardRefUid, refreshBlockInfo]);

  const onTagChange = async (tag) => {
    setCurrentIndex(0);
    handleMemoTagChange(tag);
    setIsCramming(false);

    // To prevent 'space' key event from triggering dropdown
    await asyncUtils.sleep(100);

    if (document.activeElement instanceof HTMLElement) {
      document?.activeElement.blur();
    }
  };

  // When sessions are updated, reset current index (使用 useMemo 来避免不必要的重置)
  const shouldResetIndex = React.useMemo(() => {
    return Object.keys(practiceData).length > 0;
  }, [practiceData]);

  React.useEffect(() => {
    if (shouldResetIndex) {
      setCurrentIndex(0);
    }
  }, [shouldResetIndex]);

  const onPracticeClick = React.useCallback(
    (gradeData) => {
      if (isDone) return;
      
      // 🎯 NEW: 新优先级系统不需要在练习时传递优先级数据
      // 优先级在专门的排序系统中管理，不与学习数据混合
      const practiceProps = {
        ...currentCardData,
        ...gradeData,
        intervalMultiplier,
        intervalMultiplierType,
        // 移除priority字段，因为新系统独立管理优先级
      };

      // 🚀 FIXED: 移除练习时的优先级保存，只保存学习数据
      const afterPractice = async () => {
        try {
          await handlePracticeClick(practiceProps);
          // 🚀 移除了优先级保存逻辑，将在滑块消失时批量保存
        } catch (error) {
          console.error('练习数据保存失败:', error);
        }
      };
      
      afterPractice();
      
      // 🚀 FIXED: 回到简单的索引递增
      // 批量更新状态以避免多次重新渲染
      asyncUtils.batchUpdate([
        () => setShowAnswers(false),
        () => setCurrentIndex(currentIndex + 1)
      ]);
    },
    [
      handlePracticeClick,
      isDone,
      currentIndex,
      currentCardData,
      intervalMultiplier,
      intervalMultiplierType,
      // 🚀 移除了优先级相关的依赖
    ]
  );

  const onSkipClick = React.useCallback(() => {
    if (isDone) return;

    // 批量更新状态
    asyncUtils.batchUpdate([
      () => setShowAnswers(false),
      () => setCurrentIndex(currentIndex + 1)
    ]);
  }, [currentIndex, isDone]);

  const onPrevClick = React.useCallback(() => {
    if (isFirst) return;

    // 批量更新状态
    asyncUtils.batchUpdate([
      () => setShowAnswers(false),
      () => setCurrentIndex(currentIndex - 1)
    ]);
  }, [currentIndex, isFirst]);

  const onStartCrammingClick = () => {
    // Refresh data to apply any priority changes before starting cramming
    onDataRefresh();
    setIsCramming(true);
    setCurrentIndex(0);
  };

  const lottieAnimationOption = {
    loop: true,
    autoplay: true,
    animationData: doneAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };
  const lottieStyle = {
    height: 200,
    width: 'auto',
  };

  const [showBreadcrumbs, setShowBreadcrumbs] = React.useState(true);
  const hotkeys = React.useMemo(
    () => [
      {
        combo: 'B',
        global: true,
        label: 'Show BreadCrumbs',
        onKeyDown: () => setShowBreadcrumbs(!showBreadcrumbs),
      },
    ],
    [showBreadcrumbs]
  );
  Blueprint.useHotkeys(hotkeys);

  // 层级管理：当弹窗打开时注入CSS修复，关闭时移除
  useZIndexFix(isOpen);

  // 焦点管理：当弹窗打开时激活焦点保护，关闭时停用
  // 解决memo窗口中编辑时换行切换block导致的焦点丢失问题
  useFocusFix(isOpen);

  // 🚀 NEW: 在滑块消失时批量保存优先级数据
  const shouldShowSlider = !isDone && hasCards;
  const prevShouldShowSlider = React.useRef(shouldShowSlider);
  
  React.useEffect(() => {
    // 检测滑块从显示变为隐藏（完成复习、窗口关闭等）
    if (prevShouldShowSlider.current && !shouldShowSlider) {
      if (Object.keys(rankingChanges).length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 [优先级保存] 滑块消失，批量保存优先级变更:', rankingChanges);
        }
        
        bulkSaveRankingChanges({ 
          rankingChanges, 
          dataPageTitle: dataPageTitle || 'roam/memo',
          allCardUids
        }).then(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🎯 [优先级保存] 批量保存成功');
          }
          setRankingChanges({}); // 清除已保存的变更
          setHasUnsavedChanges(false);
        }).catch(error => {
          console.error('🎯 [优先级保存] 批量保存失败:', error);
        });
      }
    }
    
    prevShouldShowSlider.current = shouldShowSlider;
  }, [shouldShowSlider, rankingChanges, dataPageTitle]);

  return (
    <MainContext.Provider
      value={{
        reviewMode,
        setReviewModeOverride,
        intervalMultiplier,
        setIntervalMultiplier,
        intervalMultiplierType,
        setIntervalMultiplierType,
        onPracticeClick,
        today,
        selectedTag,
        currentIndex,
        renderMode,
        setRenderMode,
      }}
    >
      {/* @ts-ignore */}
      <Dialog
        isOpen={isOpen}
        onClose={onCloseCallback}
        className="pb-0 bg-white"
        canEscapeKeyClose={false}
      >
        <Header
          className="bp3-dialog-header outline-none focus:outline-none focus-visible:outline-none"
          tagsList={tagsList}
          onCloseCallback={onCloseCallback}
          onTagChange={onTagChange}
          status={status}
          isDone={isDone}
          nextDueDate={nextDueDate}
          showBreadcrumbs={showBreadcrumbs}
          setShowBreadcrumbs={setShowBreadcrumbs}
          isCramming={isCramming}
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
          dir={rtlEnabled ? 'rtl' : undefined}
        >
          {currentCardRefUid ? (
            <>
              {shouldShowAnswerFirst ? (
                blockInfo.childrenUids?.map((uid) => (
                  <CardBlock
                    key={uid}
                    refUid={uid}
                    showAnswers={showAnswers}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={false}
                  />
                ))
              ) : (
                <CardBlock
                  refUid={currentCardRefUid}
                  showAnswers={showAnswers}
                  setHasCloze={setHasCloze}
                  breadcrumbs={blockInfo.breadcrumbs}
                  showBreadcrumbs={showBreadcrumbs}
                />
              )}
            </>
          ) : (
            <div data-testid="practice-overlay-done-state" className="flex items-center flex-col">
              <Lottie options={lottieAnimationOption} style={lottieStyle} />
              {/* @TODOZ: Add support for review more*/}
              {/* eslint-disable-next-line no-constant-condition */}
              {false ? (
                <div>
                  Reviewed {todaySelectedTag.completed}{' '}
                  {stringUtils.pluralize(completedTodayCount, 'card', 'cards')} today.{' '}
                  <a onClick={handleReviewMoreClick}>Review more</a>
                </div>
              ) : (
                <div>
                  You&apos;re all caught up! 🌟{' '}
                  {todaySelectedTag.completed > 0
                    ? `Reviewed ${todaySelectedTag.completed} ${stringUtils.pluralize(
                        todaySelectedTag.completed,
                        'card',
                        'cards'
                      )} today.`
                    : ''}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <Footer
          refUid={currentCardRefUid}
          onPracticeClick={onPracticeClick}
          onSkipClick={onSkipClick}
          onPrevClick={onPrevClick}
          setShowAnswers={setShowAnswers}
          showAnswers={showAnswers}
          isDone={isDone}
          hasCards={hasCards}
          onCloseCallback={onCloseCallback}
          currentCardData={currentCardData}
          onStartCrammingClick={onStartCrammingClick}
        />
        {/* Priority Slider - only show when we have cards and are not done */}
        {shouldShowSlider && (
          <PrioritySlider
            priority={currentCardRank}
            onPriorityChange={handleRankingChange}
            disabled={false}
            allCardsCount={allCardsCount}
          />
        )}
      </Dialog>
    </MainContext.Provider>
  );
};

const Dialog = styled(Blueprint.Dialog)`
  display: grid;
  grid-template-rows: 50px 1fr auto;
  max-height: 80vh;
  width: 90vw;

  ${mediaQueries.lg} {
    width: 80vw;
  }

  ${mediaQueries.xl} {
    width: 70vw;
  }
`;

const DialogBody = styled.div`
  overflow-x: hidden; // because of tweaks we do in ContentWrapper container overflows
  min-height: 200px;
`;

const HeaderWrapper = styled.div`
  justify-content: space-between;
  color: #5c7080;
  background-color: #f6f9fd;
  box-shadow: 0 1px 0 rgb(16 22 26 / 10%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-wrap: normal;
  line-height: inherit;
  margin: 0;
  min-height: 50px;

  /* Shortcut way to tag selector color */
  & .bp3-button {
    color: #5c7080;
  }
`;

const TagSelector = ({ tagsList, selectedTag, onTagChange }) => {
  return (
    // @ts-ignore
    <BlueprintSelect.Select
      items={tagsList}
      activeItem={selectedTag}
      filterable={false}
      itemRenderer={(tag, { handleClick, modifiers }) => {
        return (
          <TagSelectorItem
            text={tag}
            tagsList={tagsList}
            active={modifiers.active}
            key={tag}
            onClick={handleClick}
          />
        );
      }}
      onItemSelect={(tag) => {
        onTagChange(tag);
      }}
      popoverProps={{ minimal: true }}
    >
      <Blueprint.Button
        text={selectedTag}
        rightIcon="caret-down"
        minimal
        data-testid="tag-selector-cta"
      />
    </BlueprintSelect.Select>
  );
};

const TagSelectorItemWrapper = styled.div<{ active: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'transparent')};
  user-select: none;

  &:hover {
    cursor: pointer;
    background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)')};
  }
`;

const Tag = styled(Blueprint.Tag)`
  &.bp3-tag {
    font-size: 11px;
    padding: 1px 3px;
    min-height: auto;
    min-width: auto;
  }
`;

const TagSelectorItem = ({ text, onClick, active, tagsList }) => {
  const { today, setRenderMode } = React.useContext(MainContext);
  const dueCount = today.tags[text].due;
  const newCount = today.tags[text].new;
  const tagRenderMode = today.tags[text].renderMode || RenderMode.Normal;
  const [showTagSettings, setShowTagSettings] = React.useState(false);

  const index = tagsList.indexOf(text);
  const placement = index === tagsList.length - 1 ? 'bottom' : 'top';

  const toggleTagSettings = () => {
    setShowTagSettings(!showTagSettings);
  };

  const toggleRenderMode = () => {
    const newRenderMode =
      tagRenderMode === RenderMode.Normal ? RenderMode.AnswerFirst : RenderMode.Normal;

    setRenderMode(text, newRenderMode);
  };

  const tagSettingsMenu = (
    <div onClick={(e) => e.stopPropagation()}>
      <Blueprint.Menu className="bg-transparent min-w-full text-sm">
        <Blueprint.MenuItem
          text={
            <div className="flex items-center justify-between">
              <span className="text-xs">Swap Q/A</span>
              <Blueprint.Switch
                alignIndicator={Blueprint.Alignment.RIGHT}
                checked={tagRenderMode === RenderMode.AnswerFirst}
                onChange={toggleRenderMode}
                className="mb-0"
              />
            </div>
          }
          className="hover:bg-transparent hover:no-underline"
        />
        <Blueprint.MenuDivider />
      </Blueprint.Menu>
    </div>
  );

  return (
    <TagSelectorItemWrapper
      onClick={onClick}
      active={active}
      key={text}
      tabIndex={-1}
      data-testid="tag-selector-item"
      className="flex-col"
    >
      <div className="flex">
        <div className="flex items-center">{text}</div>
        <div className="ml-2">
          {dueCount > 0 && (
            <Tooltip content="Due" placement={placement}>
              <Tag
                active
                minimal
                intent="primary"
                className="text-center"
                data-testid="tag-selector-due"
              >
                {dueCount}
              </Tag>
            </Tooltip>
          )}
          {newCount > 0 && (
            <Tooltip content="New" placement={placement}>
              <Tag
                active
                minimal
                intent="success"
                className="text-center ml-2"
                data-testid="tag-selector-new"
              >
                {newCount}
              </Tag>
            </Tooltip>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="">
          <Blueprint.Button
            icon={<Blueprint.Icon icon={showTagSettings ? 'chevron-up' : 'cog'} size={11} />}
            className="ml-1 bp3-small"
            data-testid="tag-settings-button"
            minimal
            onClick={toggleTagSettings}
          />
        </div>
      </div>
      <Blueprint.Collapse isOpen={showTagSettings}>{tagSettingsMenu}</Blueprint.Collapse>
    </TagSelectorItemWrapper>
  );
};

const StatusBadge = ({ status, nextDueDate, isCramming }) => {
  if (isCramming) {
    return (
      <Tooltip content="Reviews don't affect scheduling" placement="left">
        <Blueprint.Tag intent="none">Cramming</Blueprint.Tag>
      </Tooltip>
    );
  }
  switch (status) {
    case 'new':
      return (
        <Blueprint.Tag intent="success" minimal>
          New
        </Blueprint.Tag>
      );

    case 'dueToday':
      return (
        <Blueprint.Tag intent="primary" minimal>
          Due Today
        </Blueprint.Tag>
      );

    case 'pastDue': {
      const timeAgo = dateUtils.customFromNow(nextDueDate);
      return (
        <Blueprint.Tag intent="warning" title={`Due ${timeAgo}`} minimal>
          Past Due
        </Blueprint.Tag>
      );
    }
    default:
      return null;
  }
};

const BoxIcon = styled(Blueprint.Icon)`
  margin-right: 5px !important;
`;

const BreadcrumbTooltipContent = ({ showBreadcrumbs }) => {
  return (
    <div className="flex align-center">
      {`${showBreadcrumbs ? 'Hide' : 'Show'} Breadcrumbs`}
      <span>
        <ButtonTags kind="light" className="mx-2">
          B
        </ButtonTags>
      </span>
    </div>
  );
};

const Header = ({
  tagsList,
  onCloseCallback,
  onTagChange,
  className,
  status,
  isDone,
  nextDueDate,
  showBreadcrumbs,
  setShowBreadcrumbs,
  isCramming,
}) => {
  const { selectedTag, today, currentIndex } = useSafeContext(MainContext);
  const todaySelectedTag = today.tags[selectedTag];
  const completedTodayCount = todaySelectedTag.completed;
  const remainingTodayCount = todaySelectedTag.due + todaySelectedTag.new;

  const currentIndexDelta = isCramming ? 0 : completedTodayCount;
  const currentDisplayCount = currentIndexDelta + currentIndex + 1;

  return (
    <HeaderWrapper className={className} tabIndex={0}>
      <div className="flex items-center">
        <BoxIcon icon="box" size={14} />
        <div tabIndex={-1}>
          <TagSelector tagsList={tagsList} selectedTag={selectedTag} onTagChange={onTagChange} />
        </div>
      </div>
      <div className="flex items-center justify-end">
        {!isDone && (
          <div onClick={() => setShowBreadcrumbs(!showBreadcrumbs)} className="px-1 cursor-pointer">
            {/* @ts-ignore */}
            <Tooltip
              content={<BreadcrumbTooltipContent showBreadcrumbs={showBreadcrumbs} />}
              placement="left"
            >
              <Blueprint.Icon
                icon={showBreadcrumbs ? 'eye-open' : 'eye-off'}
                className={showBreadcrumbs ? 'opacity-100' : 'opacity-60'}
              />
            </Tooltip>
          </div>
        )}
        <span data-testid="status-badge">
          <StatusBadge
            status={status}
            nextDueDate={nextDueDate}
            isCramming={isCramming}
            data-testid="status-badge"
          />
        </span>
        <span className="text-sm mx-2 font-medium">
          <span data-testid="display-count-current">{isDone ? 0 : currentDisplayCount}</span>
          <span className="opacity-50 mx-1">/</span>
          <span className="opacity-50" data-testid="display-count-total">
            {isDone ? 0 : remainingTodayCount}
          </span>
        </span>
        <button
          aria-label="Close"
          className="bp3-dialog-close-button bp3-button bp3-minimal bp3-icon-cross"
          onClick={onCloseCallback}
        ></button>
      </div>
    </HeaderWrapper>
  );
};

export default PracticeOverlay;
