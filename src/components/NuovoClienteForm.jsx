import { useState } from 'react'
import Modal from './common/Modal'
import { Input } from './common/FormField'
import Button from './common/Button'
import { clientiApi } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

export default function NuovoClienteForm({ open, onClose, onCreato }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ nome: '', cognome: '', indirizzo: '', telefono: '', email: '' })
  const [salvataggio, setSalvataggio] = useState(false)

  function set(campo, valore) {
    setForm((f) => ({ ...f, [campo]: valore }))
  }

  async function salva() {
    if (!form.nome && !form.cognome) {
      showToast('Inserisci almeno nome o cognome', 'error')
      return
    }
    setSalvataggio(true)
    try {
      const cliente = await clientiApi.crea(form)
      showToast('Cliente creato', 'success')
      onCreato(cliente)
      setForm({ nome: '', cognome: '', indirizzo: '', telefono: '', email: '' })
    } catch (err) {
      showToast(err.message || 'Errore nella creazione del cliente', 'error')
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo cliente"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" full onClick={onClose}>
            Annulla
          </Button>
          <Button full onClick={salva} disabled={salvataggio}>
            {salvataggio ? 'Salvataggio…' : 'Crea cliente'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          <Input label="Cognome" value={form.cognome} onChange={(e) => set('cognome', e.target.value)} />
        </div>
        <Input label="Indirizzo" value={form.indirizzo} onChange={(e) => set('indirizzo', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
