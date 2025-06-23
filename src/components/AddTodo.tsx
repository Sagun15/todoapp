import React, { useState } from 'react';
import styles from './AddTodo.module.css';

interface AddTodoProps {
  addTodo: (text: string) => void;
}

const AddTodo: React.FC<AddTodoProps> = ({ addTodo }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      addTodo(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.addTodoForm}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new todo"
        className={styles.input}
      />
      <button type="submit" className={styles.addButton}>
        Add
      </button>
    </form>
  );
};

export default AddTodo;
