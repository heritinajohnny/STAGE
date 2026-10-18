import Swal from "sweetalert2";

interface ConfirmActionOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: "warning" | "question" | "info";
}

export async function confirmAction({
  title,
  text,
  confirmButtonText = "Confirmer",
  cancelButtonText = "Annuler",
  icon = "warning",
}: ConfirmActionOptions) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "clinic-swal-popup",
      title: "clinic-swal-title",
      htmlContainer: "clinic-swal-message",
      confirmButton: "clinic-swal-confirm",
      cancelButton: "clinic-swal-cancel",
      actions: "clinic-swal-actions",
    },
  });
  return result.isConfirmed;
}

export async function showActionError(title: string, text: string) {
  await Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonText: "OK",
    buttonsStyling: false,
    customClass: {
      popup: "clinic-swal-popup",
      title: "clinic-swal-title",
      htmlContainer: "clinic-swal-message",
      confirmButton: "clinic-swal-confirm",
      actions: "clinic-swal-actions",
    },
  });
}
