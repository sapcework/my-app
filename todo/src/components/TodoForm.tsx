import { useState, KeyboardEvent } from 'react';

interface Props {
  onAdd: (text: string) => void;
}

export function TodoForm({ onAdd }: Props) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    onAdd(value);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd(); // Enterキーで追加
  };

  return (
    <div className="todo-form">
      <input
        type="text"
        className="todo-input"
        placeholder="タスクを入力..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button className="add-btn" onClick={handleAdd}>追加</button>
    </div>
  );
}
