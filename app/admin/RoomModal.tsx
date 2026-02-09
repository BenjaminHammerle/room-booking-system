"use client";

// react hooks

import { useEffect } from "react";
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

// room modal komponente
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
  // modal scroll lock
  useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [show]);


  // modal nur anzeigen wenn aktiv
  if (!show || !room) return null;

  return (
    <div className="rbs-modal-overlay animate-in fade-in duration-300">
      <div className="rbs-modal-card animate-in zoom-in-95 duration-300">
        <div className="flex flex-col md:flex-row max-h-[90vh] overflow-hidden">
          
          <div className="md:w-4/12 bg-slate-100 relative h-[280px] md:h-auto md:min-h-full">
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

            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <p className="text-white/80 text-xs font-bold uppercase flex items-center gap-2"></p>
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

          <div className="md:w-8/12 flex flex-col overflow-hidden">
            <div className="flex justify-between items-start p-6 md:p-8 border-b border-slate-100 shrink-0">
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

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Spalte 1 */}
                  <div className="space-y-4">
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_roomname")}
                      </label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) =>
                          onChange({ ...room, name: e.target.value })
                        }
                        className="rbs-input"
                        placeholder="z.B. 163"
                      />
                    </div>

                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_building_select")}
                      </label>
                      <select
                        value={room.building_id}
                        onChange={(e) =>
                          onChange({ ...room, building_id: e.target.value })
                        }
                        className="rbs-select"
                      >
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_field_image_url")}
                      </label>
                      <input
                        type="url"
                        value={room.image_url}
                        onChange={(e) =>
                          onChange({ ...room, image_url: e.target.value })
                        }
                        className="rbs-input"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
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
                        className="rbs-input"
                      />
                    </div>

                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
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
                        className="rbs-input"
                      />
                    </div>

                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_seating")}
                      </label>
                      <select
                        value={room.seating_arrangement}
                        onChange={(e) =>
                          onChange({ ...room, seating_arrangement: e.target.value })
                        }
                        className="rbs-select"
                      >
                        {SEATING_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {t(o)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_field_equipment")}
                      </label>
                      <div className="space-y-2">
                        {equipmentList.map((eq) => (
                          <label key={eq.id} className="admin-checkbox-item">
                            <input
                              type="checkbox"
                              checked={room.equipment?.includes(eq.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...(room.equipment || []), eq.id]
                                  : room.equipment.filter((x: any) => x !== eq.id);
                                onChange({ ...room, equipment: next });
                              }}
                            />
                            {getEquipmentIcon(eq.id)}
                            <span className="font-medium">
                              {getTrans(eq, "name", lang)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <details className="mt-6 group">
                  <summary className="text-[#004a87] text-sm font-black italic uppercase tracking-wider border-b-2 border-slate-100 pb-2 cursor-pointer select-none flex items-center gap-2">
                    <ChevronDown
                      size={18}
                      className="group-open:rotate-180 transition-transform"
                    />
                    {t("admin_room_expand")}
                  </summary>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Combo */}
                    <div className="rbs-modal-form-group">
                      <label className="admin-checkbox-card">
                        <input
                          type="checkbox"
                          checked={isCombi}
                          onChange={(e) => onCombiChange(e.target.checked)}
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
                              className="rbs-select"
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

                    <div className="rbs-modal-form-group">
                      <div className="flex gap-3">
                        <label
                          className={`admin-status-btn ${
                            room.is_active ? "admin-status-btn-active" : ""
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
                          className={`admin-status-btn ${
                            !room.is_active ? "admin-status-btn-inactive" : ""
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
            </div>

            <div className="rbs-modal-footer shrink-0">
              <button onClick={onClose} className="rbs-modal-btn-secondary">
                {t("archiv_back")}
              </button>
              <button onClick={onSave} className="rbs-btn-main">
                <Save size={18} />
                {room.id ? t("save_btn") : t("admin_btn_add_room")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}