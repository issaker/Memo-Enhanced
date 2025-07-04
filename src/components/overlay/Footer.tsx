import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';
import * as asyncUtils from '~/utils/async';
import { generatePracticeData } from '~/practice';
import Tooltip from '~/components/Tooltip';
import ButtonTags from '~/components/ButtonTags';
import { IntervalMultiplierType, ReviewModes } from '~/models/session';
import { MainContext } from '~/components/overlay/PracticeOverlay';
import mediaQueries from '~/utils/mediaQueries';

interface IntervalEstimate {
  reviewMode: string;
  grade: number;
  repetitions: number;
  interval: number;
  eFactor: number;
  dateCreated: string;
  nextDueDate: string;
  nextDueDateFromNow: string;
}

type IntervalEstimates =
  | undefined
  | {
      [key: number]: IntervalEstimate;
    };

const Footer = ({
  setShowAnswers,
  showAnswers,
  refUid,
  onPracticeClick,
  onSkipClick,
  onPrevClick,
  isDone,
  hasCards,
  onCloseCallback,
  currentCardData,
  onStartCrammingClick,
  fsrsEnabled = false,
}) => {
  const { reviewMode, intervalMultiplier, intervalMultiplierType } = React.useContext(MainContext);

  const [isIntervalEditorOpen, setIsIntervalEditorOpen] = React.useState(false);

  const toggleIntervalEditorOpen = () => setIsIntervalEditorOpen((prev) => !prev);
  // So we can flash the activated button when using keyboard shortcuts before transitioning
  const [activeButtonKey, setActiveButtonKey] = React.useState(null);
  const activateButtonFn = async (key, callbackFn) => {
    setActiveButtonKey(key);
    // 🚀 FLASH FIX: 对跳过操作减少延迟，减少答案闪烁
    const delay = key === 'skip-button' ? 50 : 100;
    await asyncUtils.sleep(delay);
    callbackFn();
    setActiveButtonKey(null);
  };

  const showAnswerFn = React.useMemo(() => {
    return () => {
      setShowAnswers(true);
    };
  }, [setShowAnswers]);
  const gradeFn = React.useMemo(
    () => (grade) => {
      let key;
      switch (grade) {
        case 0:
          key = 'forgot-button';
          break;
        case 2:
          key = 'hard-button';
          break;
        case 4:
          key = 'good-button';
          break;
        case 5:
          key = 'perfect-button';
          break;

        default:
          break;
      }
      activateButtonFn(key, () => onPracticeClick({ grade, refUid: refUid }));
    },
    [onPracticeClick, refUid]
  );

  const intervalPractice = React.useMemo(
    () => () => {
      activateButtonFn('next-button', () => onPracticeClick({ refUid: refUid }));
    },
    [onPracticeClick, refUid]
  );
  const skipFn = React.useMemo(
    () => () => {
      const key = 'skip-button';
      activateButtonFn(key, () => onSkipClick());
    },
    [onSkipClick]
  );

  const hotkeys = React.useMemo(
    () => [
      {
        combo: 'space',
        global: true,
        label: 'Primary Action Trigger',
        onKeyDown: () => {
          if (!showAnswers) {
            activateButtonFn('space-button', showAnswerFn);
          } else {
            if (reviewMode === ReviewModes.FixedInterval) {
              intervalPractice();
            } else {
              gradeFn(5);
            }
          }
        },
      },
      {
        combo: 'S',
        global: true,
        label: 'Skip',
        onKeyDown: skipFn,
      },
      {
        combo: 'right',
        global: true,
        label: 'Skip',
        onKeyDown: skipFn,
      },
      {
        combo: 'left',
        global: true,
        label: 'Previous',
        onKeyDown: onPrevClick,
      },
      {
        combo: 'X',
        global: true,
        label: 'Forgot (Grade 0)',
        onKeyDown: () => gradeFn(0),
        disabled: reviewMode === ReviewModes.FixedInterval,
      },
      {
        combo: 'H',
        global: true,
        label: 'Grade 2',
        onKeyDown: () => gradeFn(2),
        disabled: reviewMode === ReviewModes.FixedInterval,
      },
      {
        combo: 'G',
        global: true,
        label: 'Grade 4',
        onKeyDown: () => gradeFn(4),
        disabled: reviewMode !== ReviewModes.DefaultSpacedInterval,
      },
      {
        combo: 'E',
        global: true,
        label: 'Edit Interval',
        onKeyDown: toggleIntervalEditorOpen,
        disabled: reviewMode !== ReviewModes.FixedInterval,
      },
    ],
    [skipFn, onPrevClick, reviewMode, showAnswers, showAnswerFn, intervalPractice, gradeFn]
  );
  const { handleKeyDown, handleKeyUp } = Blueprint.useHotkeys(hotkeys);

  const intervalEstimates: IntervalEstimates = React.useMemo(() => {
    if (!currentCardData) return;

    if (!reviewMode) {
      console.error('Review mode not set');
      return;
    }
    const grades = [0, 1, 2, 3, 4, 5];
    const { interval, repetitions, eFactor, fsrsState } = currentCardData;
    const estimates = {};

    const iterateCount = reviewMode === ReviewModes.FixedInterval ? 1 : grades.length;
    for (let i = 0; i < iterateCount; i++) {
      const grade = grades[i];
      const practiceResultData = generatePracticeData({
        grade,
        interval,
        repetitions,
        eFactor,
        fsrsState, // 添加FSRS状态
        dateCreated: new Date(),
        reviewMode,
        intervalMultiplier,
        intervalMultiplierType,
        schedulingAlgorithm: fsrsEnabled ? 'FSRS' : 'SM2',
      });
      estimates[grade] = practiceResultData;
    }
    return estimates;
  }, [currentCardData, intervalMultiplier, intervalMultiplierType, reviewMode, fsrsEnabled]);

  return (
    <FooterWrapper
      className="bp3-multistep-dialog-footer flex items-center justify-center rounded-b-md p-0"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <FooterActionsWrapper
        className="bp3-dialog-footer-actions flex items-center justify-between w-full mx-5 my-3"
        data-testid="footer-actions-wrapper"
      >
        {isDone || !hasCards ? (
          <FinishedControls
            onStartCrammingClick={onStartCrammingClick}
            onCloseCallback={onCloseCallback}
          />
        ) : !showAnswers ? (
          <AnswerHiddenControls
            activateButtonFn={activateButtonFn}
            showAnswerFn={showAnswerFn}
            activeButtonKey={activeButtonKey}
          />
        ) : (
          <GradingControlsWrapper
            activateButtonFn={activateButtonFn}
            activeButtonKey={activeButtonKey}
            skipFn={skipFn}
            gradeFn={gradeFn}
            intervalEstimates={intervalEstimates}
            intervalPractice={intervalPractice}
            isIntervalEditorOpen={isIntervalEditorOpen}
            toggleIntervalEditorOpen={toggleIntervalEditorOpen}
          />
        )}
      </FooterActionsWrapper>
    </FooterWrapper>
  );
};

const AnswerHiddenControls = ({ activateButtonFn, showAnswerFn, activeButtonKey }) => (
  <>
    {/* 左区域：空 */}
    <div className="flex-shrink-0"></div>
    
    {/* 中区域：Show Answer按钮 */}
    <div className="flex-1 flex justify-center">
      {/* @ts-ignore */}
      <ControlButton
        className="text-base font-medium py-1"
        intent="none"
        onClick={() => {
          activateButtonFn('space-button', showAnswerFn);
        }}
        active={activeButtonKey === 'space-button'}
        outlined
      >
        Show Answer{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </div>
    
    {/* 右区域：空 */}
    <div className="flex-shrink-0"></div>
  </>
);

const FinishedControls = ({ onStartCrammingClick, onCloseCallback }) => {
  return (
    <>
      {/* 左区域：空 */}
      <div className="flex-shrink-0"></div>
      
      {/* 中区域：完成状态按钮 */}
      <div className="flex-1 flex justify-center gap-4">
        <Tooltip content="Review all cards without waiting for scheduling" placement="top">
          <Blueprint.Button
            className="text-base font-medium py-1"
            intent="none"
            onClick={onStartCrammingClick}
            outlined
          >
            Continue Cramming
          </Blueprint.Button>
        </Tooltip>
        <Blueprint.Button
          className="text-base font-medium py-1"
          intent="primary"
          onClick={onCloseCallback}
          outlined
        >
          Close
        </Blueprint.Button>
      </div>
      
      {/* 右区域：空 */}
      <div className="flex-shrink-0"></div>
    </>
  );
};

const GradingControlsWrapper = ({
  activateButtonFn,
  activeButtonKey,
  skipFn,
  gradeFn,
  intervalEstimates,
  intervalPractice,
  isIntervalEditorOpen,
  toggleIntervalEditorOpen,
}) => {
  const { reviewMode, setReviewModeOverride } = React.useContext(MainContext);

  const toggleReviewMode = () => {
    if (setReviewModeOverride === undefined) return;

    setReviewModeOverride((prev: ReviewModes | undefined) => {
      const isOverrideSet = prev !== undefined;

      if (isOverrideSet) {
        // If set we clear it
        return undefined;
      }

      // Toggle Review Mode
      return reviewMode === ReviewModes.DefaultSpacedInterval
        ? ReviewModes.FixedInterval
        : ReviewModes.DefaultSpacedInterval;
    });
  };

  const isFixedIntervalMode = reviewMode === ReviewModes.FixedInterval;
  return (
    <>
      {/* 左区域：Skip按钮 - 占据固定空间 */}
      <div className="flex-shrink-0">
        <ControlButton
          key="skip-button"
          className="text-base font-medium py-1"
          tooltipText={`Skip for now`}
          onClick={() => skipFn()}
          active={activeButtonKey === 'skip-button'}
          outlined
        >
          Skip{' '}
          <span className="ml-2">
            <ButtonTags>S</ButtonTags>
          </span>
        </ControlButton>
      </div>
      
      {/* 中区域：功能按钮 - 自适应空间 */}
      <div className="flex-1 flex justify-center gap-2 flex-wrap">
        {isFixedIntervalMode ? (
          <FixedIntervalModeControls
            activeButtonKey={activeButtonKey}
            intervalPractice={intervalPractice}
            isIntervalEditorOpen={isIntervalEditorOpen}
            toggleIntervalEditorOpen={toggleIntervalEditorOpen}
            intervalEstimates={intervalEstimates}
          />
        ) : (
          <SpacedIntervalModeControls
            activeButtonKey={activeButtonKey}
            gradeFn={gradeFn}
            intervalEstimates={intervalEstimates}
          />
        )}
      </div>
      
      {/* 右区域：开关按钮 - 固定大小 */}
      <div className="flex-shrink-0">
        <SetIntervalToggleWrapper 
          className="flex items-center justify-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-200" 
          style={{ minWidth: '100px' }}
        >
          <span className={`text-xs ${!isFixedIntervalMode ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            AUTO
          </span>
          <Blueprint.Switch
            className="mb-0"
            style={{ transform: 'scale(0.9)' }}
            checked={isFixedIntervalMode}
            onChange={toggleReviewMode}
            data-testid="review-mode-switch"
          />
          <span className={`text-xs ${isFixedIntervalMode ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            FIX
          </span>
        </SetIntervalToggleWrapper>
      </div>
    </>
  );
};

const FixedIntervalEditor = () => {
  const {
    intervalMultiplier,
    intervalMultiplierType,
    setIntervalMultiplier,
    setIntervalMultiplierType,
  } = React.useContext(MainContext);
  const handleInputValueChange = (numericValue) => {
    if (isNaN(numericValue)) return;
    setIntervalMultiplier(numericValue);
  };

  const intervalMultiplierTypes = [
    { value: IntervalMultiplierType.Days, label: 'Days' },
    { value: IntervalMultiplierType.Weeks, label: 'Weeks' },
    { value: IntervalMultiplierType.Months, label: 'Months' },
    { value: IntervalMultiplierType.Years, label: 'Years' },
  ];

  return (
    <div className="flex p-2 items-center w-80 justify-evenly">
      <div className="">Every</div>
      <div className="w-24">
        <Blueprint.NumericInput
          min={1}
          max={365}
          stepSize={1}
          majorStepSize={30}
          minorStepSize={1}
          value={intervalMultiplier}
          onValueChange={handleInputValueChange}
          fill
        />
      </div>
      <div className="bp3-html-select">
        <select
          value={intervalMultiplierType}
          onChange={(e) =>
            setIntervalMultiplierType(e.currentTarget.value as IntervalMultiplierType)
          }
        >
          {intervalMultiplierTypes.map((option) => (
            <option
              key={option.value}
              value={option.value}
              selected={option.value === intervalMultiplierType}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span className="bp3-icon bp3-icon-double-caret-vertical"></span>
      </div>
    </div>
  );
};

const IntervalString = ({ intervalMultiplier, intervalMultiplierType }) => {
  let singularString = '';
  if (intervalMultiplier === 1) {
    switch (intervalMultiplierType) {
      case IntervalMultiplierType.Weeks:
        singularString += 'Weekly';
        break;
      case IntervalMultiplierType.Months:
        singularString += 'Monthly';
        break;
      case IntervalMultiplierType.Years:
        singularString += 'Yearly';
        break;
      default:
        singularString += 'Daily';
        break;
    }
  }

  return (
    <>
      Review{' '}
      <span className="font-medium mr-3">
        {singularString ? (
          singularString
        ) : (
          <>
            Every {intervalMultiplier} {intervalMultiplierType}
          </>
        )}
      </span>
    </>
  );
};

const FixedIntervalModeControls = ({
  activeButtonKey,
  intervalPractice,
  isIntervalEditorOpen,
  toggleIntervalEditorOpen,
  intervalEstimates,
}: {
  activeButtonKey: string;
  intervalPractice: () => void;
  isIntervalEditorOpen: boolean;
  toggleIntervalEditorOpen: () => void;
  intervalEstimates: IntervalEstimates;
}): JSX.Element | null => {
  const { intervalMultiplier, intervalMultiplierType } = React.useContext(MainContext);
  const onInteractionhandler = (nextState) => {
    if (!nextState && isIntervalEditorOpen) toggleIntervalEditorOpen();
  };
  if (!intervalEstimates) {
    console.error('Interval estimates not set');
    return null;
  }

  return (
    <>
      <Blueprint.Popover isOpen={isIntervalEditorOpen} onInteraction={onInteractionhandler}>
        <ControlButton
          icon="time"
          className="text-base font-normal py-1"
          intent="default"
          onClick={toggleIntervalEditorOpen}
          tooltipText={`Change Interval`}
          active={activeButtonKey === 'change-interval-button'}
          outlined
        >
          <span className="ml-2">
            <IntervalString
              intervalMultiplier={intervalMultiplier}
              intervalMultiplierType={intervalMultiplierType}
            />
            <ButtonTags>E</ButtonTags>
          </span>
        </ControlButton>
        <FixedIntervalEditor />
      </Blueprint.Popover>
      <ControlButton
        icon="tick"
        className="text-base font-medium py-1"
        intent="success"
        onClick={() => intervalPractice()}
        tooltipText={`Review ${intervalEstimates[0].nextDueDateFromNow}`}
        active={activeButtonKey === 'next-button'}
        outlined
      >
        Next{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </>
  );
};

const SpacedIntervalModeControls = ({
  activeButtonKey,
  gradeFn,
  intervalEstimates,
}: {
  activeButtonKey: string;
  gradeFn: (grade: number) => void;
  intervalEstimates: IntervalEstimates;
}): JSX.Element | null => {
  if (!intervalEstimates) {
    console.error('Interval estimates not set');
    return null;
  }

  return (
    <>
      <ControlButton
        key="forget-button"
        className="text-base font-medium py-1"
        intent="danger"
        tooltipText={`Review ${intervalEstimates[0]?.nextDueDateFromNow}`}
        onClick={() => gradeFn(0)}
        active={activeButtonKey === 'forgot-button'}
        outlined
      >
        Forgot{' '}
        <span className="ml-2">
          <ButtonTags>X</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="warning"
        onClick={() => gradeFn(2)}
        tooltipText={`Review ${intervalEstimates[2]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'hard-button'}
        outlined
      >
        Hard{' '}
        <span className="ml-2">
          <ButtonTags>H</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="primary"
        onClick={() => gradeFn(4)}
        tooltipText={`Review ${intervalEstimates[4]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'good-button'}
        outlined
      >
        Good{' '}
        <span className="ml-2">
          <ButtonTags>G</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="success"
        onClick={() => gradeFn(5)}
        tooltipText={`Review ${intervalEstimates[5]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'perfect-button'}
        outlined
      >
        Perfect{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </>
  );
};

const FooterWrapper = styled.div`
  background-color: #f6f9fd;
  min-height: 50px;
  border-top: 1px solid rgba(16, 22, 26, 0.1);

  & .bp3-button-text {
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

const FooterActionsWrapper = styled.div`
  &.bp3-dialog-footer-actions .bp3-button {
    margin-left: 0;
  }

  /* 📱 Mobile portrait: Skip & Toggle share first row, grading controls second row */
  ${mediaQueries.mobilePortrait} {
    /* ❶ 重点：改成 grid，而不是 flex-column */
    display: grid !important;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'skip  toggle'
      'middle middle';
    gap: 0.5rem;

    /* ❷ 给 3 个直接子元素绑定网格区域 */
    & > :nth-child(1) { grid-area: skip;   }   /* Skip */
    & > :nth-child(2) { grid-area: middle; }   /* 中间评分按钮组 */
    & > :nth-child(3) { grid-area: toggle; justify-self: end; } /* AUTO/FIX */

    /* 字号、滚动等原有细节保持不变 */
    & .bp3-button {
      font-size: clamp(12px, 3vw, 14px);
      padding: 0.3rem 0.5rem;
      min-height: 44px; /* maintain tap target */
    }
    & > .flex-1 {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      gap: 0.25rem;
    }
  }
`;

const SetIntervalToggleWrapper = styled.div``;

const ControlButtonWrapper = styled(Blueprint.Button)``;

const ControlButton = ({ tooltipText, wrapperClassName = '', ...props }) => {
  return (
    // @ts-ignore
    <Tooltip content={tooltipText} placement="top" wrapperClassName={wrapperClassName}>
      <ControlButtonWrapper {...props} />
    </Tooltip>
  );
};

export default Footer;
