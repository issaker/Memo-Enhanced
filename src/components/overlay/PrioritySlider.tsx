import * as React from 'react';
import styled from '@emotion/styled';

interface PrioritySliderProps {
  priority: number; // 当前排名 (1=第1名，2=第2名，etc.)
  onPriorityChange: (newRank: number) => void; // 排名变更回调
  disabled: boolean;
  allCardsCount: number; // 总卡片数
}

const PriorityContainer = styled.div`
  width: 100%;
  padding: 12px 20px;
  background-color: #f6f9fd;
  border-top: 1px solid #e1e8ed;
  border-bottom: 1px solid #e1e8ed;
  position: relative;
  z-index: 1;
`;

const SliderWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledSlider = styled.input`
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, #e74c3c 0%, #f39c12 50%, #27ae60 100%);
  outline: none;
  opacity: 0.8;
  transition: opacity 0.2s;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3498db;
    cursor: grab;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.15s ease;
  }

  &::-webkit-slider-thumb:hover {
    background: #2980b9;
    transform: scale(1.1);
  }

  &::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.2);
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3498db;
    cursor: grab;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.15s ease;
  }

  &::-moz-range-thumb:hover {
    background: #2980b9;
    transform: scale(1.1);
  }

  &::-moz-range-thumb:active {
    cursor: grabbing;
    transform: scale(1.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
    background: #95a5a6;
  }

  &:disabled::-moz-range-thumb {
    cursor: not-allowed;
    background: #95a5a6;
  }
`;

const PrioritySlider: React.FC<PrioritySliderProps> = ({ 
  priority, 
  onPriorityChange, 
  disabled,
  allCardsCount,
}) => {
  // 滑块值到排名的转换（左侧=低优先级，右侧=高优先级）
  const sliderValueToRank = React.useCallback((sliderValue: number, totalCards: number) => {
    if (totalCards <= 1) return 1;
    return Math.max(1, Math.min(totalCards, totalCards - sliderValue + 1));
  }, []);

  const rankToSliderValue = React.useCallback((rank: number, totalCards: number) => {
    if (totalCards <= 1) return 1;
    return Math.max(1, Math.min(totalCards, totalCards - rank + 1));
  }, []);

  const currentSliderValue = React.useMemo(() => {
    return rankToSliderValue(priority, allCardsCount);
  }, [priority, allCardsCount, rankToSliderValue]);

  const handleSliderChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const sliderValue = parseInt(event.target.value);
    if (isNaN(sliderValue)) return;
    
    const newRank = sliderValueToRank(sliderValue, allCardsCount);
    onPriorityChange(newRank);
  }, [allCardsCount, sliderValueToRank, onPriorityChange, disabled]);

  const maxSliderValue = Math.max(1, allCardsCount);

  return (
    <PriorityContainer>
      <SliderWrapper>
        {/* 滑块本身 */}
        <StyledSlider
          type="range"
          min="1"
          max={maxSliderValue}
          value={currentSliderValue}
          onChange={handleSliderChange}
          disabled={disabled}
        />

        {/* 排名标签：绝对定位在滑块上方中间 */}
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2c3e50',
          }}
        >
          {priority} / {allCardsCount}
        </div>
      </SliderWrapper>
    </PriorityContainer>
  );
};

export default PrioritySlider; 