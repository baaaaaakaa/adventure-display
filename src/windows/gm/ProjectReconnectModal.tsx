import styles from './ProjectReconnectModal.module.css'

type ProjectReconnectModalProps = {
  directoryHandle: FileSystemDirectoryHandle | null
  isPending: boolean
  rememberedDirectoryName: string | null
  onClose: () => void
  onOpenProjectFolder: () => void | Promise<void>
  onReconnectRememberedDirectory: () => void | Promise<void>
}

export function ProjectReconnectModal({
  directoryHandle,
  isPending,
  rememberedDirectoryName,
  onClose,
  onOpenProjectFolder,
  onReconnectRememberedDirectory,
}: ProjectReconnectModalProps) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`modal-dialog ${styles.dialog}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Подтвердить папку проекта"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <span className="eyebrow">Папка проекта</span>
            <strong>Подтверди доступ к папке после перезагрузки</strong>
            <p className="editor-hint">
              {directoryHandle
                ? `Браузер помнит папку "${directoryHandle.name}", но просит ещё раз подтвердить доступ. После подтверждения проект сразу подключится снова.`
                : `Ранее была выбрана папка "${rememberedDirectoryName}", но браузер не вернул к ней прямой доступ после перезагрузки. Выбери её ещё раз, и проект сразу подключится.`}
            </p>
          </div>
          <button
            aria-label="Закрыть"
            className="ghost-button compact-button token-modal-icon-button"
            onClick={onClose}
            type="button"
          >
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className={styles.actions}>
          {directoryHandle ? (
            <button
              className="primary-button"
              disabled={isPending}
              onClick={() => {
                void onReconnectRememberedDirectory()
              }}
              type="button"
            >
              {isPending ? 'Подключаем...' : 'Подтвердить и подключить'}
            </button>
          ) : null}
          <button
            className={directoryHandle ? 'ghost-button' : 'primary-button'}
            disabled={isPending}
            onClick={() => {
              void onOpenProjectFolder()
            }}
            type="button"
          >
            {directoryHandle ? 'Выбрать другую папку' : 'Выбрать папку заново'}
          </button>
        </div>
      </div>
    </div>
  )
}
