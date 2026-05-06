import { useState, useEffect } from 'react';
import type { Todo, Filter } from '../types';

const STORAGE_KEY = 'todos';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY); // 初回レンダリング時にlocalStorageから読み込む
    return saved ? JSON.parse(saved) : [];
  });
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); // todosが変わるたびに保存
  }, [todos]);

  const addTodo = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodos(prev => [
      { id: crypto.randomUUID(), text: trimmed, completed: false, createdAt: Date.now() }, // 新しいタスクを先頭に追加
      ...prev,
    ]);
  };

  const toggleTodo = (id: string) => {
    setTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(todo => !todo.completed));
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;

  return { todos: filteredTodos, filter, setFilter, addTodo, toggleTodo, deleteTodo, clearCompleted, activeCount };
}
