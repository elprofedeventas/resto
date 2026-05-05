/* RESTO — Editor de plano del salón.
   Solo Owner. Drag & drop con mouse nativo, snap a grid de 20 px. */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  createTable,
  deleteTable,
  getTables,
  updateTable
} from '../../services/tables.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Select from '../../components/Select/Select.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import styles from './PlanEditor.module.css';

const GRID = 20;
const CAPACITY_SIZES = { 2: 60, 4: 80, 6: 100, 8: 120 };
const CAPACITY_OPTIONS = [
  { value: 2, label: '2 personas' },
  { value: 4, label: '4 personas' },
  { value: 6, label: '6 personas' },
  { value: 8, label: '8 personas' }
];

function snap(n) {
  return Math.max(0, Math.round(n / GRID) * GRID);
}

function tableSize(capacity) {
  return CAPACITY_SIZES[capacity] || 80;
}

function DraggableTable({ table, selected, onSelect, onMove }) {
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: table.x, y: table.y });

  useEffect(() => {
    setPosition({ x: table.x, y: table.y });
  }, [table.x, table.y]);

  useEffect(() => {
    if (!dragging) return undefined;

    function handleMove(event) {
      setPosition({
        x: snap(event.clientX - offset.x),
        y: snap(event.clientY - offset.y)
      });
    }

    function handleUp() {
      setDragging(false);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, offset]);

  useEffect(() => {
    if (!dragging && (position.x !== table.x || position.y !== table.y)) {
      onMove(table.id, position.x, position.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  function handleMouseDown(event) {
    event.preventDefault();
    onSelect(table.id);
    setOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
    setDragging(true);
  }

  const size = tableSize(table.capacity);
  const className = [
    styles.table,
    !table.active ? styles.tableInactive : '',
    selected ? styles.tableSelected : '',
    dragging ? styles.tableDragging : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{
        left: position.x,
        top: position.y,
        width: size,
        height: size
      }}
      onMouseDown={handleMouseDown}
    >
      <span className={styles.tableNumber}>{table.number}</span>
      <span className={styles.tableCapacity}>{table.capacity}p</span>
    </div>
  );
}

function CreateTableModal({ isOpen, onClose, onCreate }) {
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setNumber('');
    setCapacity(4);
    setError('');
    onClose();
  }

  async function handleSave() {
    setError('');
    if (!number.trim()) {
      setError('Número de mesa obligatorio.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({ number, capacity, x: 40, y: 40 });
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Agregar mesa"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Creando...' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className={styles.modalForm}>
        <Input
          label="Número de mesa"
          placeholder="M01, T05, B12..."
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <Select
          label="Capacidad"
          options={CAPACITY_OPTIONS}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function SelectedPanel({ table, onUpdate, onDelete }) {
  const [number, setNumber] = useState(table.number);
  const [capacity, setCapacity] = useState(table.capacity);
  const [active, setActive] = useState(table.active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNumber(table.number);
    setCapacity(table.capacity);
    setActive(table.active);
    setError('');
  }, [table.id, table.number, table.capacity, table.active]);

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await onUpdate(table.id, { number, capacity, active });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError('');
    setDeleting(true);
    try {
      await onDelete(table.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card padding="md" className={styles.panel}>
      <h3>Mesa {table.number}</h3>
      <Input
        label="Número"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <Select
        label="Capacidad"
        options={CAPACITY_OPTIONS}
        value={capacity}
        onChange={(e) => setCapacity(Number(e.target.value))}
      />
      <Toggle checked={active} onChange={setActive} label="Mesa activa" />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.panelActions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </div>

      <p className={styles.muted}>
        Posición: x={table.x}, y={table.y}. Arrastra la mesa con el ratón
        para reubicarla.
      </p>
    </Card>
  );
}

function PlanEditor({ onClose }) {
  const { token, activeLocaleId } = useAuth();
  const canvasRef = useRef(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    try {
      const list = await getTables(token, activeLocaleId);
      setTables(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocaleId, token]);

  async function handleMove(id, x, y) {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
    try {
      await updateTable(token, activeLocaleId, id, { x, y });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function handleUpdate(id, patch) {
    const updated = await updateTable(token, activeLocaleId, id, patch);
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  }

  async function handleDelete(id) {
    await deleteTable(token, activeLocaleId, id);
    setTables((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  }

  async function handleCreate(data) {
    const created = await createTable(token, activeLocaleId, data);
    setTables((prev) => [...prev, created]);
  }

  function handleCanvasClick(event) {
    if (event.target === canvasRef.current) {
      setSelectedId(null);
    }
  }

  const selected = tables.find((t) => t.id === selectedId);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Editor de plano</h1>
          <p className={styles.subtitle}>
            Local: {activeLocaleId}. Arrastra las mesas para ubicarlas.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Agregar mesa
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.workspace}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={handleCanvasClick}
        >
          {loading && <p className={styles.muted}>Cargando...</p>}
          {!loading &&
            tables.map((t) => (
              <DraggableTable
                key={t.id}
                table={t}
                selected={t.id === selectedId}
                onSelect={setSelectedId}
                onMove={handleMove}
              />
            ))}
          {!loading && tables.length === 0 && (
            <p className={styles.canvasEmpty}>
              Aún no hay mesas. Agrega la primera con el botón superior.
            </p>
          )}
        </div>

        <aside className={styles.aside}>
          {selected ? (
            <SelectedPanel
              table={selected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <Card padding="md" className={styles.panel}>
              <h3>Sin selección</h3>
              <p className={styles.muted}>
                Haz click en una mesa para editarla, o arrastra para
                reubicarla.
              </p>
            </Card>
          )}
        </aside>
      </div>

      <CreateTableModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </main>
  );
}

export default PlanEditor;
