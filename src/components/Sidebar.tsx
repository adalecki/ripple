import React, { useState, useEffect } from 'react';
import { ListGroup, Form, Button } from 'react-bootstrap';

import '../css/Sidebar.css'

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
  filterOptions: string[];
  title: string;
  onDeleteItem?: (id: number) => void;
  initialFilter?: string
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  selectedItemId,
  setSelectedItemId,
  filterOptions,
  title,
  onDeleteItem,
  initialFilter
}) => {
  const [filter, setFilter] = useState<string>(initialFilter || 'all');

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

  const filteredItems = items.filter(item =>
    filter === 'all' ? true : item.type === filter
  );

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
  };

  return (
    <div className="sidebar">

      {title && (
        <>
          <h5>{title}</h5>
          <Form.Select
            size="sm"
            value={filter}
            onChange={handleFilterChange}
            className="mb-3"
          >
            <option value="all">All {title}</option>
            {filterOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Form.Select>
        </>
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
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="btn btn-danger btn-small"
                  >
                    X
                  </Button>
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