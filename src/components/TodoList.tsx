import React from 'react';
import { Todo } from '../types';
import styles from './TodoList.module.css';
import { useTransition, animated, useSpring } from '@react-spring/web';

interface TodoListProps {
  todos: Todo[];
  toggleTodo: (id: number) => void;
  deleteTodo: (id: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, toggleTodo, deleteTodo }) => {
  const transitions = useTransition(todos, {
    keys: todo => todo.id,
    from: { opacity: 0, height: 0, transform: 'translateX(-100%)' },
    enter: { opacity: 1, height: 50, transform: 'translateX(0%)' },
    leave: { opacity: 0, height: 0, transform: 'translateX(100%)' },
  });

  return (
    <ul className={styles.todoList}>
      {transitions((style, todo) => (
        <animated.li style={style} className={styles.todoItem}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
            className={styles.checkbox}
          />
          <AnimatedText completed={todo.completed}>
            {todo.text}
          </AnimatedText>
          <button
            onClick={() => deleteTodo(todo.id)}
            className={styles.deleteButton}
          >
            ×
          </button>
        </animated.li>
      ))}
    </ul>
  );
};

const AnimatedText: React.FC<{ completed: boolean; children: React.ReactNode }> = ({ completed, children }) => {
  const props = useSpring({
    to: {
      opacity: completed ? 0.5 : 1,
      textDecoration: completed ? 'line-through' : 'none',
    },
  });

  return (
    <animated.span className={styles.todoText} style={props}>
      {children}
    </animated.span>
  );
};

export default TodoList;
