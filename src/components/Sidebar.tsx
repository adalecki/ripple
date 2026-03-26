import React, { useState, useEffect } from 'react';
import { ListGroup, Form, Button } from 'react-bootstrap';

import '../css/Sidebar.css'
import { Plus, X } from 'lucide-react';

interface SidebarItem {
  id: number;
  name: string;
  type: string;
  details?: { [key: string]: string | number };
}

interface SidebarProps {
  items: SidebarItem[];
  selectedItemId: number | null;
  setSelectedItemId: (id: number | null) => void;
  filterOptions?: string[];
  title: string;
  onAddItem?: () => void;
  onDeleteItem?: (id: number) => void;
  initialFilter?: string
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  selectedItemId,
  setSelectedItemId,
  filterOptions,
  title,
  onAddItem,
  onDeleteItem,
  initialFilter
}) => {
  const [filter, setFilter] = useState<string>(initialFilter || 'all');

  const singularTitle = title.endsWith('s') ? title.slice(0, -1) : title;

  useEffect(() => {
    if (!selectedItemId) return;

    const isSelectedVisible = items.some(item =>
      item.id === selectedItemId && (filter === 'all' || item.type === filter)
    );

    if (!isSelectedVisible) {
      const firstVisibleItem = items.find(item =>
        filter === 'all' || item.type === filter
      );

      setSelectedItemId(firstVisibleItem ? firstVisibleItem.id : null);
    }
  }, [filter, items, selectedItemId, setSelectedItemId]);

  const filteredItems = filterOptions
    ? items.filter(item => filter === 'all' || item.type === filter)
    : items;

  return (
    <div className="sidebar">

      {title && (
        <div>
          <div className='item-list-header'>
            <h5>{title}</h5>
            {onAddItem &&
              <button
                type="button"
                className="item-list-btn"
                onClick={onAddItem}
                title={`Add ${singularTitle}`}
              >
                <Plus size={16} />
              </button>}
          </div>
          {filterOptions && filterOptions.length > 0 && (
            <Form.Select
              size="sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mb-3"
            >
              <option value="all">All</option>
              {filterOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Form.Select>
          )}

        </div>
      )}
      <div className="item-list-container">
        <ListGroup className="item-list">
          {filteredItems.map((item) => (
            <ListGroup.Item
              key={item.id}
              active={item.id === selectedItemId}
              onClick={() => setSelectedItemId(item.id)}
              className="sidebar-item"
            >
              <div className="item-info">
                <span className="item-name">{item.name}</span>
                {onDeleteItem && (
                  <button
                    type='button'
                    className='item-list-btn item-list-btn-delete'
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="item-details">
                <span className="item-type">{item.type}</span>
                {item.details ? Object.entries(item.details).map(([key, value]) => (
                  <span key={key} className="item-count">
                    {key}: {value}
                  </span>
                )) : ''}
              </div>

            </ListGroup.Item>
          ))}
        </ListGroup>
      </div>
    </div>
  );
};

export default Sidebar;