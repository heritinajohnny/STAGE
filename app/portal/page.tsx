"use client";

import { FormEvent, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, HeartPulse, ShieldCheck, Sparkles, X } from "lucide-react";
import { LogoutButton } from "../components/layout/LogoutButton";
import { confirmAction } from "../lib/confirm";

interface User {
  name: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone: string;
  address: string;
}
interface Appointment { id: number; appointmentDate: string; status: string; reason: string | null; doctorName: string; doctorFirstName: string; }
interface NotificationItem { id: number; message: string; readAt: string | null; createdAt: string; href: string; }
interface Doctor { id: number; firstName: string; lastName: string; specialty: string; }
interface AvailableSlot { doctorId: number; doctorName: string; specialty: string; appointmentDate: string; durationMinutes: number; }
interface WaitlistEntry {
  id: number;
  doctorId: number | null;
  specialty: string | null;
  requestedFrom: string;
  requestedTo: string;
  status: string;
  offeredDoctorId: number | null;
  offeredAppointmentDate: string | null;
  position: number | null;
}
interface ConsultationHistoryItem {
  id: number;
  consultationDate: string;
  diagnosis: string;
  prescription: string | null;
  notes: string | null;
  doctorFirstName: string;
  doctorLastName: string;
  specialty: string;
}
interface BookingPatient {
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
}
interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}
type BookingStep = "search" | "patient" | "reason" | "confirm" | "done";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente de validation",
  CONFIRME: "Confirmé",
  PRISE_EN_CHARGE: "Confirmé",
  TERMINE: "Consulté",
  ANNULE: "Annulé",
};

export default function PortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistoryItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [profileError, setProfileError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "", birthDate: "", gender: "", address: "" });
  const [preferredSpecialty, setPreferredSpecialty] = useState("");
  const [preferredFrom, setPreferredFrom] = useState("");
  const [preferredTo, setPreferredTo] = useState("");
  const [hasSearchedSlots, setHasSearchedSlots] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "Bonjour ! Dites-moi quel spécialiste vous souhaitez voir et quand, par exemple : « je veux voir un pédiatre mardi matin »." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatStep, setChatStep] = useState<BookingStep>("search");
  const [chatBusy, setChatBusy] = useState(false);
  const [searchContext, setSearchContext] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingPatient, setBookingPatient] = useState<BookingPatient | null>(null);
  const [appointmentReason, setAppointmentReason] = useState("");

  const profileComplete = Boolean(
    user?.firstName && user.lastName && user.birthDate && user.gender && user.phone,
  );

  async function loadPortal() {
    const [userResponse, appointmentResponse, notificationResponse, doctorResponse, waitlistResponse, historyResponse] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/portal/appointments"),
      fetch("/api/notifications"),
      fetch("/api/portal/doctors"),
      fetch("/api/portal/waitlist"),
      fetch("/api/portal/history"),
    ]);
    if (userResponse.ok) {
      const data = (await userResponse.json()) as { user?: User };
      if (data.user) {
        setUser(data.user);
        const parts = data.user.name.trim().split(/\s+/);
        setProfileForm((current) => ({
          firstName: current.firstName || data.user?.firstName || parts.slice(0, -1).join(" ") || parts[0] || "",
          lastName: current.lastName || data.user?.lastName || (parts.length > 1 ? parts[parts.length - 1] : ""),
          phone: current.phone || data.user?.phone || "",
          birthDate: current.birthDate || data.user?.birthDate || "",
          gender: current.gender || data.user?.gender || "",
          address: current.address || data.user?.address || "",
        }));
      }
    }
    if (appointmentResponse.ok) setAppointments((await appointmentResponse.json()) as Appointment[]);
    if (notificationResponse.ok) setNotifications((await notificationResponse.json()) as NotificationItem[]);
    if (doctorResponse.ok) setDoctors((await doctorResponse.json()) as Doctor[]);
    if (waitlistResponse.ok) setWaitlist((await waitlistResponse.json()) as WaitlistEntry[]);
    if (historyResponse.ok) setConsultationHistory((await historyResponse.json()) as ConsultationHistoryItem[]);
    setLoading(false);
  }

  const loadPortalFromEffect = useEffectEvent(() => loadPortal());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortalFromEffect().catch(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function addChatMessage(role: ChatMessage["role"], content: string) {
    setChatMessages((messages) => [...messages, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  }

  function formatSlot(slot: AvailableSlot) {
    return new Date(slot.appointmentDate).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  }

  async function searchSlotsFromConversation(prompt: string) {
    setAvailableSlots([]);
    setHasSearchedSlots(false);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const assistantResponse = await fetch("/api/portal/booking-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(-240), today }),
    });
    const filters = await assistantResponse.json() as {
      specialty?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
      periodOfDay?: "MORNING" | "AFTERNOON" | "ANY";
      error?: string;
    };
    if (!assistantResponse.ok) throw new Error(filters.error || "Je n’ai pas compris la demande. Pouvez-vous préciser la spécialité et le jour ?");
    if (!filters.dateFrom) {
      setSearchContext(prompt.slice(-200));
      addChatMessage("assistant", "Quel jour ou quelle période vous conviendrait ? Vous pouvez répondre, par exemple, « mardi matin ».");
      return;
    }

    const dateTo = filters.dateTo || filters.dateFrom;
    setPreferredSpecialty(filters.specialty || "");
    setPreferredFrom(filters.dateFrom);
    setPreferredTo(dateTo);
    setHasSearchedSlots(true);
    const query = new URLSearchParams({
      from: filters.dateFrom,
      to: dateTo,
      ...(filters.specialty ? { specialty: filters.specialty } : {}),
    });
    const availabilityResponse = await fetch(`/api/availability?${query}`);
    const available = await availabilityResponse.json() as AvailableSlot[] | { error?: string };
    if (!availabilityResponse.ok || !Array.isArray(available)) {
      throw new Error(!Array.isArray(available) ? available.error || "Impossible de rechercher les créneaux." : "Impossible de rechercher les créneaux.");
    }
    const slots = available.filter((slot) => {
      const hour = new Date(slot.appointmentDate).getHours();
      if (filters.periodOfDay === "MORNING") return hour < 12;
      if (filters.periodOfDay === "AFTERNOON") return hour >= 12;
      return true;
    }).slice(0, 8);
    setAvailableSlots(slots);
    setSearchContext("");
    if (slots.length === 0) {
      addChatMessage("assistant", "Je n’ai pas trouvé de créneau libre correspondant à cette demande. Essayez un autre jour ou inscrivez-vous sur la liste d’attente.");
      return;
    }
    const options = slots.map((slot) => `${formatSlot(slot)} avec ${slot.doctorName}`).join(" ; ");
    addChatMessage("assistant", `Voici les créneaux réellement disponibles${filters.specialty ? ` en ${filters.specialty}` : ""} : ${options}. Lequel vous convient ?`);
  }

  function parseBirthDate(value: string) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
    }
    const local = /^(\d{2})[/. -](\d{2})[/. -](\d{4})$/.exec(value);
    if (!local) return null;
    const [, day, month, year] = local;
    const date = `${year}-${month}-${day}`;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
  }

  async function submitChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy || chatStep === "done") return;
    setChatInput("");
    addChatMessage("user", text);
    setChatBusy(true);
    try {
      if (chatStep === "search") {
        await searchSlotsFromConversation(searchContext ? `${searchContext} ${text}` : text);
      } else if (chatStep === "patient") {
        if (/^(moi|moi-même|pour moi|pour moi-même)$/i.test(text)) {
          if (!user?.firstName || !user.lastName || !user.birthDate) {
            addChatMessage("assistant", "Votre profil n’est pas complet. Enregistrez d’abord vos informations personnelles.");
            return;
          }
          setBookingPatient({ firstName: user.firstName, lastName: user.lastName, fullName: `${user.firstName} ${user.lastName}`, birthDate: user.birthDate });
          setChatStep("reason");
          addChatMessage("assistant", "Quel est le motif du rendez-vous ? Vous pouvez répondre « aucun » si vous préférez ne pas préciser.");
          return;
        }

        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}[/. -]\d{2}[/. -]\d{4})/);
        const birthDate = dateMatch ? parseBirthDate(dateMatch[1]) : null;
        const fullName = dateMatch
          ? text.replace(dateMatch[0], "").replace(/[,;:]|\b(mon fils|ma fille|mon enfant|pour|patient|patiente|c'est|c’est)\b/gi, " ").trim().replace(/\s+/g, " ")
          : "";
        if (!birthDate || fullName.length < 5 || !fullName.includes(" ")) {
          addChatMessage("assistant", "Indiquez le nom complet du patient et sa date de naissance, par exemple « Heritina Zafinamboa, 26/05/1993 ». Un dossier minimal sera créé si nécessaire. Pour vous-même, répondez « moi ».");
          return;
        }
        const [firstName, ...lastNameParts] = fullName.split(/\s+/);
        const patient = { firstName, lastName: lastNameParts.join(" "), fullName, birthDate };
        setBookingPatient(patient);
        setChatStep("reason");
        addChatMessage("assistant", `Merci. Je rechercherai le dossier de ${patient.fullName} et le créerai s’il n’existe pas. Quel est le motif du rendez-vous ?`);
      } else if (chatStep === "reason") {
        setAppointmentReason(/^(aucun|pas de motif|je préfère ne pas préciser)$/i.test(text) ? "" : text.slice(0, 1000));
        setChatStep("confirm");
        if (!selectedSlot || !bookingPatient) throw new Error("La sélection du créneau ou du patient a été perdue. Recommencez la recherche.");
        const reason = /^(aucun|pas de motif|je préfère ne pas préciser)$/i.test(text) ? "Non précisé" : text;
        addChatMessage("assistant", `Je récapitule : ${bookingPatient.firstName} ${bookingPatient.lastName}, ${selectedSlot.doctorName} (${selectedSlot.specialty}), le ${formatSlot(selectedSlot)}${reason ? `, motif : ${reason}` : ""}. Est-ce que je confirme ? Répondez « oui » ou « non ».`);
      } else if (chatStep === "confirm") {
        if (/^(non|non merci|annuler|pas maintenant)$/i.test(text)) {
          setChatStep("search");
          setSelectedSlot(null);
          setBookingPatient(null);
          setAppointmentReason("");
          setAvailableSlots([]);
          addChatMessage("assistant", "D’accord, je n’ai rien réservé. Dites-moi si vous souhaitez chercher un autre créneau.");
          return;
        }
        if (!/^(oui|oui confirme|confirmer|je confirme|oui je confirme)$/i.test(text)) {
          addChatMessage("assistant", "Souhaitez-vous confirmer ce rendez-vous ? Répondez simplement « oui » ou « non ».");
          return;
        }
        if (!selectedSlot || !bookingPatient) throw new Error("La sélection du créneau ou du patient a été perdue. Recommencez la recherche.");
        const response = await fetch("/api/portal/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorId: selectedSlot.doctorId,
            appointmentDate: selectedSlot.appointmentDate,
            patientFirstName: bookingPatient.firstName,
            patientLastName: bookingPatient.lastName,
            patientFullName: bookingPatient.fullName,
            patientBirthDate: bookingPatient.birthDate,
            reason: appointmentReason,
          }),
        });
        const result = await response.json() as { id?: number; error?: string };
        if (!response.ok) {
          setChatStep("search");
          setSelectedSlot(null);
          setBookingPatient(null);
          setAppointmentReason("");
          setAvailableSlots([]);
          addChatMessage("assistant", `${result.error || "La réservation a échoué."} Dites-moi si vous souhaitez rechercher un autre créneau.`);
          return;
        }
        setChatStep("done");
        addChatMessage("assistant", `C’est réservé ! Votre demande de rendez-vous n°${result.id} est enregistrée et reste en attente de confirmation par la clinique.`);
        await loadPortal();
      }
    } catch (reason) {
      addChatMessage("assistant", reason instanceof Error ? reason.message : "Impossible de traiter votre demande. Réessayez.");
    } finally {
      setChatBusy(false);
    }
  }

  function chooseSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setAvailableSlots([]);
    setBookingPatient(null);
    setAppointmentReason("");
    setChatStep("patient");
    addChatMessage("user", formatSlot(slot));
    addChatMessage("assistant", "Pour quel patient souhaitez-vous le rendez-vous ? Répondez « moi » ou indiquez le nom complet et la date de naissance d’un patient déjà inscrit.");
  }

  function restartConversation() {
    setChatStep("search");
    setChatInput("");
    setSearchContext("");
    setSelectedSlot(null);
    setBookingPatient(null);
    setAppointmentReason("");
    setAvailableSlots([]);
    setHasSearchedSlots(false);
    setChatMessages([{ id: `${Date.now()}-welcome`, role: "assistant", content: "Bonjour ! Dites-moi quel spécialiste vous souhaitez voir et quand, par exemple : « je veux voir un pédiatre mardi matin »." }]);
  }

  async function joinWaitlist() {
    setHasSearchedSlots(false);
    try {
      const response = await fetch("/api/portal/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty: preferredSpecialty || null,
          requestedFrom: new Date(`${preferredFrom}T00:00:00`).toISOString(),
          requestedTo: new Date(`${preferredTo}T23:59:59`).toISOString(),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setHasSearchedSlots(true);
        addChatMessage("assistant", result.error || "Impossible de vous inscrire sur la liste d’attente.");
        return;
      }
      setHasSearchedSlots(false);
      addChatMessage("assistant", "Votre demande a été ajoutée à la liste d’attente. La clinique vous contactera si un créneau se libère.");
      await loadPortal();
    } catch {
      setHasSearchedSlots(true);
      addChatMessage("assistant", "Impossible de contacter le serveur pour vous inscrire sur la liste d’attente. Réessayez.");
    }
  }

  async function respondToWaitlist(entry: WaitlistEntry, accept: boolean) {
    const confirmed = await confirmAction({
      title: accept ? "Accepter ce créneau ?" : "Refuser cette proposition ?",
      text: accept
        ? "Ce créneau sera confirmé pour votre rendez-vous."
        : "La proposition de rendez-vous sera refusée.",
      confirmButtonText: accept ? "Accepter" : "Refuser",
      icon: accept ? "question" : "warning",
    });
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/portal/waitlist/${entry.id}`, { method: accept ? "PATCH" : "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        addChatMessage("assistant", result.error || "Impossible de traiter votre réponse.");
        return;
      }
      await loadPortal();
    } catch {
      addChatMessage("assistant", "Impossible de contacter le serveur. Réessayez.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!await confirmAction({
      title: "Confirmer la modification",
      text: "Enregistrer les modifications de votre profil ?",
      confirmButtonText: "Enregistrer",
      icon: "question",
    })) return;
    setSavingProfile(true);
    setProfileError("");
    try {
      const response = await fetch("/api/portal/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setProfileError(result.error || "Le profil n’a pas pu être enregistré.");
        return;
      }
      await loadPortal();
    } catch {
      setProfileError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function cancelAppointment(appointment: Appointment) {
    const confirmed = await confirmAction({
      title: "Annuler ce rendez-vous ?",
      text: "Cette action annulera votre demande de rendez-vous.",
      confirmButtonText: "Annuler le rendez-vous",
    });
    if (!confirmed) return;
    setCancelingId(appointment.id);
    setCancelError("");
    try {
      const response = await fetch(`/api/portal/appointments/${appointment.id}`, { method: "PATCH" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCancelError(result.error || "Le rendez-vous n’a pas pu être annulé.");
        return;
      }
      await loadPortal();
    } catch {
      setCancelError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setCancelingId(null);
    }
  }

  async function markNotificationsRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <a className="auth-brand" href="/portal"><span className="brand-mark"><HeartPulse size={22} /></span><span>PSFA<span className="brand-period">.</span></span></a>
        <div className="portal-header-actions"><span className="portal-user-name">{user?.name}</span><LogoutButton location="portal" /></div>
      </header>
      <section className="portal-content portal-content-wide">
        <span className="eyebrow">ESPACE PERSONNEL</span>
        <h1>Bonjour{user ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
        <p className="portal-lead">Demandez un rendez-vous et suivez les réponses de la clinique depuis cet espace.</p>
        <div className="portal-profile"><div className="portal-profile-icon"><ShieldCheck size={22} /></div><div><span className="portal-label">COMPTE VÉRIFIÉ</span><h2>{user?.name || "Chargement du profil..."}</h2><p>{user?.email || " "}</p></div></div>

        <div className="portal-columns">
          <section className="portal-panel">
            {!profileComplete && (
              <form className="portal-booking-form" onSubmit={saveProfile}>
                <div className="portal-section-title"><ShieldCheck size={19} /><div><h2>Compléter votre profil</h2><p>Ces informations seront enregistrées une seule fois dans votre compte.</p></div></div>
                <div className="portal-form-row">
                  <label>Prénom<input required minLength={2} maxLength={100} value={profileForm.firstName} onChange={(event) => setProfileForm({ ...profileForm, firstName: event.target.value })} /></label>
                  <label>Nom<input required minLength={2} maxLength={100} value={profileForm.lastName} onChange={(event) => setProfileForm({ ...profileForm, lastName: event.target.value })} /></label>
                </div>
                <div className="portal-form-row">
                  <label>Téléphone<input required type="tel" minLength={6} maxLength={20} value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="+261 ..." /></label>
                  <label>Date de naissance<input required type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm({ ...profileForm, birthDate: event.target.value })} /></label>
                </div>
                <label className="portal-booking-form label">Sexe<select required value={profileForm.gender} onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}><option value="">Choisir</option><option value="F">Féminin</option><option value="M">Masculin</option><option value="AUTRE">Autre</option></select></label>
                <label className="portal-booking-form label">Adresse<textarea maxLength={500} rows={2} value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} placeholder="Votre adresse (facultatif)" /></label>
                {profileError && <p className="portal-form-message error" role="alert">{profileError}</p>}
                <button className="portal-submit" type="submit" disabled={savingProfile}>{savingProfile ? "Enregistrement..." : "Enregistrer mon profil"}</button>
              </form>
            )}
            {profileComplete && (
              <>
                <div className="portal-section-title"><CalendarDays size={19} /><div><h2>Réserver un rendez-vous</h2><p>Discutez avec l’assistant : il cherchera des créneaux disponibles et vous demandera confirmation avant de réserver.</p></div></div>
                <section className="booking-chat" aria-label="Dialogue de réservation">
                  <div className="booking-chat-heading"><Sparkles size={17} /><strong>Assistant de réservation</strong></div>
                  <div className="booking-chat-transcript" role="log" aria-live="polite">
                    {chatMessages.map((message) => (
                      <p className={`booking-chat-message ${message.role}`} key={message.id}>
                        <strong>{message.role === "assistant" ? "Assistant" : "Vous"}</strong>
                        <span>{message.content}</span>
                      </p>
                    ))}
                    {chatBusy && <p className="booking-chat-typing" role="status">L’assistant prépare la réponse...</p>}
                  </div>
                  {availableSlots.length > 0 && chatStep === "search" && (
                    <div className="booking-chat-slots" aria-label="Créneaux réellement disponibles">
                      {availableSlots.map((slot) => (
                        <button key={`${slot.doctorId}-${slot.appointmentDate}`} type="button" onClick={() => chooseSlot(slot)}>
                          <strong>{formatSlot(slot)}</strong><span>{slot.doctorName} · {slot.specialty}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {hasSearchedSlots && availableSlots.length === 0 && chatStep === "search" && preferredFrom && preferredTo && (
                    <button className="booking-chat-waitlist" type="button" onClick={() => void joinWaitlist()}>M’inscrire sur la liste d’attente</button>
                  )}
                  {chatStep === "search" && chatMessages.length === 1 && doctors.length > 0 && (
                    <div className="portal-assistant-suggestions">
                      <span>Exemples :</span>
                      {Array.from(new Set(doctors.map((doctor) => doctor.specialty))).slice(0, 3).map((specialty) => {
                        const examples = [
                          `Je voudrais un rendez-vous en ${specialty} aujourd’hui`,
                          `Je voudrais un rendez-vous en ${specialty} demain matin`,
                        ];
                        return examples.map((example) => <button key={`${specialty}-${example}`} type="button" onClick={() => setChatInput(example)}>{example}</button>);
                      })}
                    </div>
                  )}
                  <form className="portal-assistant-form" onSubmit={(event) => void submitChatMessage(event)}>
                    <input
                      aria-label="Votre message à l’assistant de réservation"
                      maxLength={1000}
                      disabled={chatBusy || chatStep === "done"}
                      placeholder={chatStep === "patient" ? "Nom complet et date de naissance, ou « moi »" : chatStep === "reason" ? "Motif de la consultation" : chatStep === "confirm" ? "Répondez oui ou non" : chatStep === "done" ? "Demande envoyée" : "Ex. : je veux voir un pédiatre mardi matin"}
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                    />
                    <button type="submit" disabled={chatBusy || chatStep === "done" || !chatInput.trim()}>{chatBusy ? "..." : chatStep === "confirm" ? "Répondre" : "Envoyer"}</button>
                  </form>
                  <p className="portal-assistant-disclaimer">Seule la demande de recherche est transmise à OpenAI. Le nom, la date de naissance et le motif restent dans la clinique. Un dossier minimal est créé si nécessaire.</p>
                  {chatStep === "done" && <button className="booking-chat-reset" type="button" onClick={restartConversation}>Nouvelle demande</button>}
                </section>
              </>
            )}
          </section>
          <section className="portal-panel">
            <div className="portal-section-title"><ShieldCheck size={19} /><div><h2>Historique des consultations</h2><p>Vos informations de consultation enregistrées.</p></div></div>
            {consultationHistory.length === 0 ? <p className="portal-muted">Aucune consultation enregistrée.</p> : <ul className="portal-appointments">{consultationHistory.map((item) => (
              <li key={item.id}>
                <div className="portal-appointment-top"><strong>Dr. {item.doctorFirstName} {item.doctorLastName} · {item.specialty}</strong></div>
                <time>{new Date(item.consultationDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time>
                <p><strong>Diagnostic :</strong> {item.diagnosis}</p>
                {item.prescription && <p><strong>Prescription :</strong> {item.prescription}</p>}
                {item.notes && <p><strong>Notes :</strong> {item.notes}</p>}
              </li>
            ))}</ul>}
          </section>

          <div className="portal-side-column">
            <section className="portal-panel" id="notifications">
              <div className="portal-section-title"><Bell size={19} /><div><h2>Notifications</h2><p>Réponses et mises à jour de la clinique.</p></div></div>
              {notifications.length === 0 ? <p className="portal-muted">Aucune notification pour le moment.</p> : <ul className="portal-notifications">{notifications.map((item) => <li key={item.id} className={!item.readAt ? "unread" : ""}><Link href={item.href} className="notification-link"><span className="notification-dot" /><span><span className="notification-message">{item.message}</span><time>{new Date(item.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time></span></Link></li>)}</ul>}
              {notifications.some((item) => !item.readAt) && <button className="portal-read-button" onClick={markNotificationsRead}>Marquer comme lues</button>}
            </section>
            <section className="portal-panel" id="mes-rendez-vous">
              <div className="portal-section-title"><CalendarDays size={19} /><div><h2>Mes rendez-vous</h2><p>État des demandes envoyées.</p></div></div>
              {cancelError && <p className="portal-form-message error" role="alert">{cancelError}</p>}
              {loading ? <p className="portal-muted">Chargement...</p> : appointments.length === 0 ? <p className="portal-muted">Vous n’avez pas encore de demande.</p> : <ul className="portal-appointments">{appointments.map((appointment) => <li key={appointment.id}><div className="portal-appointment-top"><strong>Dr. {appointment.doctorFirstName} {appointment.doctorName}</strong><span className={`portal-status status-${appointment.status.toLowerCase()}`}>{statusLabels[appointment.status] || "Historique"}</span></div><time>{new Date(appointment.appointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time>{appointment.reason && <p>{appointment.reason}</p>}{["EN_ATTENTE", "CONFIRME"].includes(appointment.status) && new Date(appointment.appointmentDate) > new Date() && <button className="portal-cancel" type="button" disabled={cancelingId === appointment.id} onClick={() => cancelAppointment(appointment)}><X size={14} /> {cancelingId === appointment.id ? "Annulation..." : "Annuler le rendez-vous"}</button>}</li>)}</ul>}
            </section>
            <section className="portal-panel">
              <div className="portal-section-title"><CalendarDays size={19} /><div><h2>Liste d’attente</h2><p>Propositions de créneaux et position de votre demande.</p></div></div>
              {waitlist.length === 0 ? <p className="portal-muted">Aucune inscription en attente.</p> : <ul className="portal-appointments">{waitlist.map((entry) => (
                <li key={entry.id}>
                  <div className="portal-appointment-top"><strong>{entry.specialty || "Toutes spécialités"}{entry.position ? ` · Position ${entry.position}` : ""}</strong><span className={`portal-status status-${entry.status.toLowerCase()}`}>{entry.status === "WAITING" ? "En attente" : entry.status === "PROPOSED" ? "Créneau proposé" : entry.status === "BOOKED" ? "Réservé" : "Annulé"}</span></div>
                  <time>{new Date(entry.requestedFrom).toLocaleDateString("fr-FR")} – {new Date(entry.requestedTo).toLocaleDateString("fr-FR")}</time>
                  {entry.status === "PROPOSED" && entry.offeredAppointmentDate && <><p>Créneau proposé le {new Date(entry.offeredAppointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p><button type="button" className="portal-submit" onClick={() => void respondToWaitlist(entry, true)}>Accepter le créneau</button><button type="button" className="portal-cancel" onClick={() => void respondToWaitlist(entry, false)}>Refuser la proposition</button></>}
                  {entry.status === "WAITING" && <button type="button" className="portal-cancel" onClick={() => void respondToWaitlist(entry, false)}>Quitter la liste d’attente</button>}
                </li>
              ))}</ul>}
            </section>
          </div>
        </div>
      </section>
      <footer className="portal-footer">PSFA · Un accompagnement attentif, à chaque étape.</footer>
    </main>
  );
}
