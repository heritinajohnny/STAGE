import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "default" | "wide";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "default",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 sm:items-center">
      <div className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg bg-white p-5 shadow-lg sm:p-6 ${size === "wide" ? "max-w-2xl" : "max-w-lg"} animate-fade-in`}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4 border-b pb-3">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 text-2xl font-bold leading-none text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
