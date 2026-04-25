/**
 * Toast — lightweight notification system (bottom-right, auto-dismiss 3s).
 * Uses Zustand slice + Framer Motion.
 */
import { create } from 'zustand'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Store ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: ToastItem[]
  push: (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

let counter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push(message, type = 'success') {
    const id = `toast-${++counter}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    // Auto-dismiss after 3s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

// Convenience export
export const toast = {
  success: (msg: string) => useToastStore.getState().push(msg, 'success'),
  error: (msg: string) => useToastStore.getState().push(msg, 'error'),
  info: (msg: string) => useToastStore.getState().push(msg, 'info'),
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
}

const BORDER: Record<ToastType, string> = {
  success: 'border-emerald-500/20',
  error: 'border-red-500/20',
  info: 'border-blue-500/20',
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'flex items-center gap-2.5 bg-[#1a1d2e]/95 backdrop-blur-xl border rounded-xl px-4 py-2.5 shadow-2xl pointer-events-auto',
              BORDER[t.type],
            )}
          >
            {ICONS[t.type]}
            <span className="text-xs text-white/80 max-w-[260px]">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="ml-1 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
