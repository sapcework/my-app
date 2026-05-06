import { useTodos } from './hooks/useTodos';
import { TodoForm } from './components/TodoForm';
import { TodoItem } from './components/TodoItem';
import type { Filter } from './types';
import './App.css';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'すべて', value: 'all' },
  { label: '未完了', value: 'active' },
  { label: '完了済み', value: 'completed' },
];

export default function App() {
  const { todos, filter, setFilter, addTodo, toggleTodo, deleteTodo, clearCompleted, activeCount } = useTodos();

  return (
    <div className="app">
      <h1 className="title">Todoリスト</h1>

      <TodoForm onAdd={addTodo} />

      <div className="filters">
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-btn ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {todos.length === 0 ? (
        <p className="empty">タスクがありません</p>
      ) : (
        <ul className="todo-list">
          {todos.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
        </ul>
      )}

      <div className="footer">
        <span className="count">{activeCount} 件未完了</span>
        <button className="clear-btn" onClick={clearCompleted}>完了済みを削除</button>
      </div>
    </div>
  );
}
