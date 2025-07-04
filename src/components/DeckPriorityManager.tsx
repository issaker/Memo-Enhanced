import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';
import Tooltip from '~/components/Tooltip';
import OffsetSlider from '~/components/OffsetSlider';

interface DeckPriorityInfo {
  deckName: string;
  medianPriority: number;
  cardCount: number;
}

interface Props {
  deckPriorities: Record<string, DeckPriorityInfo>;
  selectedDeck?: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyOffset: (deckName: string, offsetValue: number) => Promise<void>;
}

const DeckPriorityManager = ({
  deckPriorities,
  selectedDeck,
  isOpen,
  onClose,
  onApplyOffset,
}: Props) => {
  const [editingDeck, setEditingDeck] = React.useState<string | null>(null);
  const [tempPriority, setTempPriority] = React.useState<number>(50);
  const [originalPriority, setOriginalPriority] = React.useState<number>(50);
  const [isApplying, setIsApplying] = React.useState<boolean>(false);

  const sortedDecks = React.useMemo(() => {
    return Object.values(deckPriorities).sort((a, b) => {
      // 其他按照优先级降序排列
      return b.medianPriority - a.medianPriority;
    });
  }, [deckPriorities]);

  const handleEditClick = (deck: DeckPriorityInfo) => {
    setEditingDeck(deck.deckName);
    setTempPriority(deck.medianPriority);
    setOriginalPriority(deck.medianPriority);
  };

  const handleSave = async () => {
    if (editingDeck && onApplyOffset) {
      setIsApplying(true);
      try {
        // 计算绝对偏移值：tempPriority 是目标优先级，originalPriority 是原始优先级
        const offsetValue = tempPriority - originalPriority;
        await onApplyOffset(editingDeck, offsetValue);
        setEditingDeck(null);
      } catch (error) {
        console.error('应用牌组偏移失败:', error);
      } finally {
        setIsApplying(false);
      }
    }
  };

  const handleCancel = () => {
    setEditingDeck(null);
    setIsApplying(false);
  };

  return (
    <Blueprint.Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="牌组优先级管理"
      style={{ width: '600px' }}
    >
      <DialogContent className="bp3-dialog-body">
        {Object.keys(deckPriorities).length === 0 ? (
          <SpinnerContainer>
            <Blueprint.Spinner />
          </SpinnerContainer>
        ) : (
          <Blueprint.HTMLTable className="bp3-html-table bp3-html-table-striped" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>牌组名称</th>
                <th>卡片数量</th>
                <th>中位数优先级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedDecks.map((deck) => (
                <tr key={deck.deckName} className={selectedDeck === deck.deckName ? 'selected' : ''}>
                  <td>
                    <DeckName>
                      {deck.deckName}
                    </DeckName>
                  </td>
                  <td>{deck.cardCount}</td>
                  <td>
                    {editingDeck === deck.deckName ? (
                      <PriorityEditor>
                        <OffsetSlider 
                          initialPriority={originalPriority}
                          onPriorityChange={setTempPriority}
                        />
                      </PriorityEditor>
                    ) : (
                      <PriorityDisplay>
                        <PriorityBar priority={deck.medianPriority} />
                        <span>{deck.medianPriority}%</span>
                      </PriorityDisplay>
                    )}
                  </td>
                  <td>
                    {editingDeck === deck.deckName ? (
                      <Blueprint.ButtonGroup>
                        <Blueprint.Button
                          icon={isApplying ? <Blueprint.Spinner size={12} /> : "tick"}
                          intent="success"
                          small
                          onClick={handleSave}
                          disabled={isApplying}
                        />
                        <Blueprint.Button
                          icon="cross"
                          intent="danger"
                          small
                          onClick={handleCancel}
                          disabled={isApplying}
                        />
                      </Blueprint.ButtonGroup>
                    ) : (
                      <Tooltip content="调整牌组内所有卡片的优先级">
                        <Blueprint.Button
                          icon="edit"
                          small
                          onClick={() => handleEditClick(deck)}
                          disabled={deck.cardCount === 0}
                        />
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Blueprint.HTMLTable>
        )}
        
        <InfoSection>
          <Blueprint.Callout intent="primary" icon="info-sign">
            <h4>牌组优先级说明</h4>
            <ul>
              <li>每个牌组的优先级是其所有卡片优先级的中位数。</li>
              <li>在编辑模式下，使用滑块设置一个**绝对偏移量**（-100 至 +100 点）。</li>
              <li>保存后，该牌组内所有卡片的优先级将按此偏移量进行批量调整。</li>
              <li>优先级越高，卡片在混合学习队列中越靠前。</li>
              <li>超出 0-100 范围的优先级会自动限制在边界内。</li>
            </ul>
          </Blueprint.Callout>
        </InfoSection>
      </DialogContent>
      
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Blueprint.Button onClick={onClose}>关闭</Blueprint.Button>
        </div>
      </div>
    </Blueprint.Dialog>
  );
};

const DialogContent = styled.div`
  max-height: 500px;
  overflow-y: auto;
  
  tr.selected {
    background-color: rgba(19, 124, 189, 0.1);
  }
`;

const DeckName = styled.div`
  display: flex;
  align-items: center;
  font-weight: 500;
`;

const PriorityDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PriorityBar = styled.div<{ priority: number }>`
  width: 50px;
  height: 6px;
  background-color: #e1e8ed;
  border-radius: 3px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${props => props.priority}%;
    background-color: ${props => {
      if (props.priority >= 70) return '#0f9960';
      if (props.priority >= 40) return '#d69e2e';
      return '#db3737';
    }};
    border-radius: 3px;
    transition: width 0.3s ease;
  }
`;

const PriorityEditor = styled.div`
  display: flex;
  align-items: center;
`;

const InfoSection = styled.div`
  margin-top: 20px;
`;

const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
`;

export default DeckPriorityManager; 