import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Users, Clock, MessageSquare, Sparkles, Smile } from "lucide-react";

export function ReservationTable() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("2 Guests");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00 PM");
  const [occasion, setOccasion] = useState("");
  const [requests, setRequests] = useState("");

  const timeSlots = [
    "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", 
    "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM", 
    "09:00 PM", "10:00 PM", "11:00 PM"
  ];

  const guestOptions = [
    "1 Guest", "2 Guests", "3 Guests", "4 Guests", "5 Guests", "6 Guests", "7+ Guests"
  ];

  const occasionOptions = [
    "Casual Dining", "Birthday", "Anniversary", "Date Night", "Celebration", "Family Gathering"
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Format the date for readability if selected
    const formattedDate = date ? new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }) : "Not specified";

    const message = `Hello SMOOBUDS Kakinada! I would like to reserve a table.

✨ *RESERVATION DETAILS* ✨
━━━━━━━━━━━━━━━━━━━
👤 *Name:* ${name}
📞 *Phone:* ${phone}
👥 *Guests:* ${guests}
📅 *Date:* ${formattedDate}
⏰ *Time:* ${time}
🎉 *Occasion:* ${occasion || "Casual Dessert Session"}
📝 *Special Requests:* ${requests || "None"}
━━━━━━━━━━━━━━━━━━━

Please confirm my reservation. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    // Standard WhatsApp API URL using the business reservations number
    const whatsappUrl = `https://wa.me/919121292306?text=${encodedMessage}`;
    
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section id="reservations" className="relative bg-cream py-28 md:py-40 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-gold/5 filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-sage/5 filter blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-4xl px-6">
        <div className="text-center mb-16">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-sage font-display font-semibold mb-5">
            ✦ Experience Luxury
          </p>
          <h2 className="font-display text-4xl md:text-7xl font-extrabold leading-[0.95] tracking-tight text-sage-deep">
            Reserve A <span className="font-signature font-normal text-gold text-[1.2em] not-italic">Table</span>
          </h2>
          <p className="mt-6 text-sm md:text-base text-sage-deep/75 max-w-md mx-auto leading-relaxed">
            Reserve your spot at Kakinada's premier dessert lounge. Book via WhatsApp for instant communication and confirmations.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-3xl border border-sage/10 bg-white/40 backdrop-blur-xl p-8 md:p-12 shadow-luxe"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep placeholder:text-sage-deep/40 outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep placeholder:text-sage-deep/40 outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80 flex items-center gap-1.5">
                  <Calendar size={12} className="text-gold" /> Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                />
              </div>

              {/* Time */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80 flex items-center gap-1.5">
                  <Clock size={12} className="text-gold" /> Preferred Time
                </label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all appearance-none cursor-pointer"
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guests */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80 flex items-center gap-1.5">
                  <Users size={12} className="text-gold" /> Guests
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all appearance-none cursor-pointer"
                >
                  {guestOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Occasion */}
              <div className="space-y-2">
                <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-gold" /> Special Occasion
                </label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select occasion (optional)</option>
                  {occasionOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <label className="text-[0.65rem] uppercase tracking-[0.2em] font-display font-bold text-sage-deep/80 flex items-center gap-1.5">
                <MessageSquare size={12} className="text-gold" /> Special Requests
              </label>
              <textarea
                rows={3}
                placeholder="Any dietary restrictions, seat preferences, or celebration details?"
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                className="w-full rounded-xl border border-sage/15 bg-white/60 px-5 py-3.5 text-sm text-sage-deep placeholder:text-sage-deep/40 outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="text-center pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-gold text-sage-deep font-display font-bold text-xs uppercase tracking-[0.2em] hover:shadow-gold hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <Smile size={16} /> Book via WhatsApp
              </button>
              <p className="mt-3 text-[0.65rem] text-sage-deep/50 tracking-[0.1em]">
                Instant reservation request. We will reply to confirm availability.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
