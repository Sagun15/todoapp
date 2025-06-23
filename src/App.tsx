import React, { useState, useMemo } from 'react';
import TodoList from './components/TodoList';
import AddTodo from './components/AddTodo';
import { Todo } from './types';
import styles from './App.module.css';
import { useTransition, animated } from '@react-spring/web';

const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const addTodo = (text: string) => {
    const newTodo: Todo = { id: Date.now(), text, completed: false };
    setTodos([...todos, newTodo]);
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos(todos.filter((todo) => !todo.completed));
  };

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
  }, [todos, filter]);

  const counts = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((todo) => todo.completed).length;
    const active = total - completed;
    return { total, completed, active };
  }, [todos]);

  const statsTransition = useTransition(counts, {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    update: { opacity: 1, transform: 'translateY(0px)' },
  });

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <h1 className={styles.title}>Sagun's Todo App</h1>
        {statsTransition((style, count) => (
          <animated.div style={style} className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{count.total}</span>
              <span className={styles.statLabel}>Total</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{count.active}</span>
              <span className={styles.statLabel}>Active</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{count.completed}</span>
              <span className={styles.statLabel}>Completed</span>
            </div>
          </animated.div>
        ))}
        <AddTodo addTodo={addTodo} />
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterButton} ${filter === 'active' ? styles.active : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`${styles.filterButton} ${filter === 'completed' ? styles.active : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
        <TodoList
          todos={filteredTodos}
          toggleTodo={toggleTodo}
          deleteTodo={deleteTodo}
        />
        <button className={styles.clearCompleted} onClick={clearCompleted}>
          Clear Completed
        </button>
      </div>
    </div>
  );
};

export default App;
