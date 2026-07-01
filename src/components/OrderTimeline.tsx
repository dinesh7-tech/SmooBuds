import { motion } from "framer-motion";
import { Clock, Receipt, ChefHat, CheckCircle, Bell, ConciergeBell } from "lucide-react";

export type OrderStatus = "Pending" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";

interface TimelineProps {
  status: OrderStatus;
  orderTime: string;
}

const STAGES = [
  { id: "Pending", label: "Pending", icon: Clock },
  { id: "Accepted", label: "Accepted", icon: Bell },
  { id: "Preparing", label: "Preparing", icon: ChefHat },
  { id: "Ready", label: "Ready", icon: ConciergeBell },
  { id: "Served", label: "Completed", icon: CheckCircle },
];

export function OrderTimeline({ status, orderTime }: TimelineProps) {
  if (status === "Cancelled") {
    return (
      <div className="bg-red-50 text-red-600 rounded-xl p-4 text-center border border-red-100 font-display font-semibold text-sm">
        This order has been cancelled.
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.id === status);
  const activeIndex = currentStageIndex === -1 ? 0 : currentStageIndex;

  return (
    <div className="py-6 px-2 w-full overflow-hidden">
      <div className="relative flex justify-between items-center w-full">
        {/* Background inactive line */}
        <div className="absolute top-1/2 left-4 right-4 h-1 bg-[#D8D2C7] rounded-full -translate-y-1/2 z-0" />

        {/* Animated active line */}
        <motion.div
          className="absolute top-1/2 left-4 h-1 bg-[#4F706B] rounded-full -translate-y-1/2 z-0 origin-left"
          initial={{ width: "0%" }}
          animate={{
            width: `${(activeIndex / (STAGES.length - 1)) * 100}%`,
          }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />

        {/* Shimmer effect for "Preparing" */}
        {status === "Preparing" && (
          <motion.div
            className="absolute top-1/2 left-4 h-1 -translate-y-1/2 z-0 rounded-full"
            style={{ 
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
              width: "30%"
            }}
            animate={{
              x: ["0%", "300%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "linear"
            }}
          />
        )}

        {/* Stages */}
        {STAGES.map((stage, index) => {
          const isCompleted = index < activeIndex;
          const isActive = index === activeIndex;

          const Icon = stage.icon;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center">
              {/* Dot / Icon Container */}
              <motion.div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500 shadow-sm ${
                  isActive || isCompleted
                    ? "bg-[#4F706B] border-[#4F706B] text-white"
                    : "bg-[#F8F5EF] border-[#D8D2C7] text-gray-400"
                }`}
                initial={false}
                animate={isActive ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Icon size={16} className={isActive && status === "Served" ? "animate-in zoom-in" : ""} />

                {/* Pulse Effect for Active Stage */}
                {isActive && (status === "Pending" || status === "Preparing") && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#4F706B]/30"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  />
                )}
                
                {/* Expanding Glow for Ready/Completed */}
                {isActive && (status === "Ready" || status === "Served") && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#4F706B]"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                )}
              </motion.div>

              {/* Label */}
              <div className="absolute top-10 md:top-12 flex flex-col items-center w-16 md:w-24 text-center">
                <span
                  className={`text-[9px] md:text-[10px] font-display font-extrabold uppercase tracking-widest transition-colors duration-500 mt-1 ${
                    isActive || isCompleted ? "text-[#1F2937]" : "text-gray-400"
                  }`}
                >
                  {stage.label}
                </span>
                {index === 0 && (
                  <span className="text-[8px] md:text-[9px] text-gray-500 font-semibold mt-0.5 whitespace-nowrap opacity-80">
                    {orderTime}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Spacer for labels */}
      <div className="h-8 md:h-12" />
    </div>
  );
}
