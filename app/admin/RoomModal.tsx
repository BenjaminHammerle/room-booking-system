"use client";

import {
  Monitor,
  X,
  Save,
  CheckCircle,
  Power,
  Layers,
  ChevronDown,
} from "lucide-react";

interface Room {
  id?: string;
  name: string;
  building_id: string;
  image_url: string;
  capacity: number;
  floor: number;
  seating_arrangement: string;
  equipment: string[];
  is_active: boolean;
}

interface RoomModalProps {
  show: boolean;
  room: Room | null;
  isCombi: boolean;
  combiParts: string[];
  buildings: any[];
  rooms: any[];
  equipmentList: any[];
  SEATING_OPTIONS: string[];
  onClose: () => void;
  onSave: () => void;
  onChange: (room: Room) => void;
  onCombiChange: (val: boolean) => void;
  onCombiPartsChange: (parts: string[]) => void;
  t: (key: string) => string;
  getTrans: (obj: any, field: string, lang: string) => string;
  getEquipmentIcon: (id: string) => any;
  lang: string;
  modalTitle?: string;
  modalSubtitle?: string;
}

export default function RoomModal({
  show,
  room,
  isCombi,
  combiParts,
  buildings,
  rooms,
  equipmentList,
  SEATING_OPTIONS,
  onClose,
  onSave,
  onChange,
  onCombiChange,
  onCombiPartsChange,
  t,
  getTrans,
  getEquipmentIcon,
  lang,
  modalTitle,
  modalSubtitle,
}: RoomModalProps) {
  if (!show || !room) return null;

  return (
    <div className="mci-modal-overlay animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
        {/* LEFT SIDE: BILD VOLLE HÖHE */}
        <div className="md:w-4/12 bg-slate-100 relative min-h-[300px] md:min-h-full">
          {room.image_url ? (
            <img
              src={room.image_url}
              alt="Preview"
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#004a87]/5 text-slate-300 p-8 text-center">
              <Monitor size={60} className="mb-4 opacity-20" />
              <p className="text-xs font-black uppercase italic tracking-widest opacity-40">
                {t("admin_label_image")} Preview
              </p>
            </div>
          )}

          {/* Identity Badge Overlay - Title oben, Subtitle unten */}
          <div className="absolute inset-0 flex flex-col justify-between p-8">
            {/* Titel OBEN */}
            <p className="text-white/80 text-xs font-bold uppercase flex items-center gap-2">
             
            </p>

            {/* Name UNTEN */}
            <div className="bg-gradient-to-t from-slate-900/80 to-transparent pt-8 -mx-8 -mb-8 px-8 pb-8">
              <h3 className="text-white text-2xl font-black italic uppercase tracking-tighter leading-none">
                {room.name || t("admin_label_roomname")}
              </h3>
              <p className="text-white/60 text-xs font-bold uppercase mt-2">
                {t("admin_title_rooms")}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: FORMULAR (SCROLLBAR) */}
        <div className="md:w-8/12 p-8 md:p-12 flex flex-col bg-white md:max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-[#004a87] text-xl font-black italic uppercase tracking-tight leading-none mb-2">
                {t("admin_title_rooms")}
              </h2>
              <p className="text-slate-400 text-xs font-black uppercase italic tracking-widest">
                {room.id ? "ID: " + room.id.slice(0, 8) : "New Room"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-red-500"
            >
              <X size={24} />
            </button>
          </div>

          {/* SCROLLBARER CONTENT */}
          <div className="space-y-6 flex-1">
            

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Spalte 1 */}
              <div className="space-y-4">
                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_label_roomname")}
                  </label>
                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) =>
                      onChange({ ...room, name: e.target.value })
                    }
                    className="mci-input bg-slate-50 border-none rounded-2xl"
                    placeholder="z.B. 163"
                  />
                </div>

                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_label_building_select")}
                  </label>
                  <select
                    value={room.building_id}
                    onChange={(e) =>
                      onChange({ ...room, building_id: e.target.value })
                    }
                    className="mci-select bg-slate-50 border-none rounded-2xl"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_field_image_url")}
                  </label>
                  <input
                    type="url"
                    value={room.image_url}
                    onChange={(e) =>
                      onChange({ ...room, image_url: e.target.value })
                    }
                    className="mci-input bg-slate-50 border-none rounded-2xl"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Spalte 2 */}
              <div className="space-y-4">
                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_label_capacity")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={room.capacity}
                    onChange={(e) =>
                      onChange({ ...room, capacity: parseInt(e.target.value) })
                    }
                    className="mci-input bg-slate-50 border-none rounded-2xl"
                  />
                </div>

                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_label_floor")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={room.floor}
                    onChange={(e) =>
                      onChange({ ...room, floor: parseInt(e.target.value) })
                    }
                    className="mci-input bg-slate-50 border-none rounded-2xl"
                  />
                </div>

                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_label_seating")}
                  </label>
                  <select
                    value={room.seating_arrangement}
                    onChange={(e) =>
                      onChange({ ...room, seating_arrangement: e.target.value })
                    }
                    className="mci-select bg-slate-50 border-none rounded-2xl"
                  >
                    {SEATING_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {t(o)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Spalte 3: Equipment */}
              <div className="space-y-4">
                <div className="mci-modal-form-group">
                  <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1">
                    {t("admin_field_equipment")}
                  </label>
                  <div className="space-y-2">
                    {equipmentList.map((eq) => (
                      <label
                        key={eq.id}
                        className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={room.equipment?.includes(eq.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(room.equipment || []), eq.id]
                              : room.equipment.filter((x: any) => x !== eq.id);
                            onChange({ ...room, equipment: next });
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="flex items-center gap-2 font-medium">
                          {getEquipmentIcon(eq.id)}
                          {getTrans(eq, "name", lang)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Erweiterte Optionen */}
            <details className="mt-6 group">
              <summary className="text-[#004a87] text-sm font-black italic uppercase tracking-wider border-b-2 border-slate-100 pb-2 cursor-pointer select-none flex items-center gap-2">
                <ChevronDown
                  size={18}
                  className="group-open:rotate-180 transition-transform"
                />
                {t("admin_room_expand")}
              </summary>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Combo - KEIN Subtitle */}
                <div className="mci-modal-form-group">
                  <label className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl cursor-pointer hover:bg-purple-100 border border-purple-200 transition-all">
                    <input
                      type="checkbox"
                      checked={isCombi}
                      onChange={(e) => onCombiChange(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                      <Layers size={16} />
                      {t("admin_label_is_combi")}
                    </div>
                  </label>

                  {isCombi && (
                    <div className="mt-3 space-y-2">
                      {[0, 1, 2].map((idx) => (
                        <select
                          key={idx}
                          value={combiParts[idx] || ""}
                          onChange={(e) => {
                            const n = [...combiParts];
                            n[idx] = e.target.value;
                            onCombiPartsChange(n);
                          }}
                          className="mci-select bg-slate-50 border-none rounded-2xl text-sm"
                        >
                          <option value="">
                            {t("admin_label_combi_parts")}
                          </option>
                          {rooms
                            .filter((r) => r.id !== room.id)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                        </select>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status - KEIN Label, nur Buttons */}
                <div className="mci-modal-form-group">
                  <div className="flex gap-3">
                    <label
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl cursor-pointer border-2 transition-all ${
                        room.is_active
                          ? "bg-green-50 border-green-500 text-green-700"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={room.is_active}
                        onChange={() => onChange({ ...room, is_active: true })}
                        className="sr-only"
                      />
                      <CheckCircle size={18} />
                      <span className="font-bold text-xs">
                        {t("admin_status_active")}
                      </span>
                    </label>

                    <label
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl cursor-pointer border-2 transition-all ${
                        !room.is_active
                          ? "bg-orange-50 border-orange-500 text-orange-700"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={!room.is_active}
                        onChange={() => onChange({ ...room, is_active: false })}
                        className="sr-only"
                      />
                      <Power size={18} />
                      <span className="font-bold text-xs">
                        {t("admin_status_maintenance")}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Action Area */}
          <div className="mci-modal-footer">
            <button onClick={onClose} className="mci-modal-btn-secondary">
              {t("archiv_back")}
            </button>

            <button onClick={onSave} className="mci-modal-btn-primary">
              <Save size={18} />
              {room.id ? t("save_btn") : t("admin_btn_add_room")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
