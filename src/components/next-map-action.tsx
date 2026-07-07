"use client";

import {useRef} from "react";

type NextMapActionProps = {
  canOpenNextMap: boolean;
  completionPercent: number;
};

export function NextMapAction({ canOpenNextMap, completionPercent }: NextMapActionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = canOpenNextMap ? "next-map-ready-title" : "next-map-locked-title";
  const remainingPercent = Math.max(0, 100 - completionPercent);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button className={`ghost-button next-map-action ${canOpenNextMap ? "ready" : "locked"}`} type="button" onClick={openDialog}>
        {canOpenNextMap ? "Открыть следующую карту" : `Следующая карта закрыта · ${remainingPercent}%`}
      </button>

      <dialog className="battle-dialog next-map-dialog" ref={dialogRef} aria-labelledby={titleId}>
        <div className="battle-dialog-header">
          <div>
            <p className="eyebrow">Следующая карта</p>
            <h2 id={titleId}>{canOpenNextMap ? "Карта открыта" : "Карта пока закрыта"}</h2>
          </div>
          <button className="dialog-close" type="button" aria-label="Закрыть" onClick={closeDialog}>×</button>
        </div>

        <div className="next-map-dialog-body">
          {canOpenNextMap ? (
            <p>Текущая карта пройдена. Следующая карта открыта.</p>
          ) : (
            <p>Следующая карта откроется, когда все карточки текущей карты будут пройдены. Сейчас: {completionPercent}%, осталось {remainingPercent}%.</p>
          )}
          <div className="next-map-threshold" aria-label="Порог открытия следующей карты">
            <span style={{ width: `${Math.min(100, completionPercent)}%` }} />
          </div>
        </div>

        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={closeDialog}>К карте</button>
        </div>
      </dialog>
    </>
  );
}
