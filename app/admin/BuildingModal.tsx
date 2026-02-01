"use client";

import {
  Home,
  MapPin,
  Clock,
  Layers,
  Wifi,
  PlusCircle,
  X,
  Save,
  Accessibility,
} from "lucide-react";

interface Building {
  id?: string;
  name: string;
  distance: number;
  floors: number;
  latitude: number;
  longitude: number;
  mci_wifi_ip: string;
  accessible: boolean;
  image_url: string;
  is_active: boolean;
}

interface BuildingModalProps {
  show: boolean;
  building: Building | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (building: Building) => void;
  t: (key: string) => string;
}

export default function BuildingModal({
  show,
  building,
  onClose,
  onSave,
  onChange,
  t,
}: BuildingModalProps) {
  if (!show || !building) return null;

  return (
    <div className="mci-modal-overlay animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
        {/* LEFT SIDE: DYNAMISCHE BILDVORSCHAU */}
        <div className="md:w-5/12 bg-slate-100 relative min-h-[300px]">
          {building.image_url ? (
            <img
              src={building.image_url}
              alt="Preview"
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#004a87]/5 text-slate-300 p-8 text-center">
              <Home size={60} className="mb-4 opacity-20" />
              <p className="text-xs font-black uppercase italic tracking-widest opacity-40">
                {t("admin_label_image")} Preview
              </p>
            </div>
          )}

          {/* Identity Badge Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex flex-col justify-end p-8">
            <h3 className="text-white text-3xl font-black italic uppercase tracking-tighter leading-none">
              {building.name || "MCI Campus"}
            </h3>
            <p className="text-white/60 text-xs font-bold uppercase mt-2 flex items-center gap-2">
              {t("admin_title_buildings")}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: FORMULAR & EINSTELLUNGEN */}
        <div className="md:w-7/12 p-8 md:p-12 flex flex-col bg-white md:max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-[#004a87] text-2xl font-black italic uppercase tracking-tight leading-none mb-2">
                {t("admin_title_buildings")}
              </h2>
              <p className="text-slate-400 text-xs font-black uppercase italic tracking-widest">
                {building.id
                  ? "ID: " + building.id.slice(0, 8)
                  : "New Registration"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-red-500"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            {/* Building Name */}
            <div className="mci-modal-form-group">
              <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                <Home size={10} /> {t("admin_field_name")}
              </label>
              <input
                type="text"
                value={building.name}
                onChange={(e) =>
                  onChange({ ...building, name: e.target.value })
                }
                className="mci-input bg-slate-50 border-none rounded-2xl"
                placeholder="z.B. MCI 1"
              />
            </div>

            {/* Grid: Distance & Floors - responsive unter 500px */}
            <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-4">
              <div className="mci-modal-form-group text-left">
                <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                  <Clock size={10} /> {t("filter_dist")} (Min)
                </label>
                <input
                  type="number"
                  value={building.distance}
                  onChange={(e) =>
                    onChange({
                      ...building,
                      distance: parseInt(e.target.value),
                    })
                  }
                  className="mci-input bg-slate-50 border-none rounded-2xl"
                />
              </div>
              <div className="mci-modal-form-group text-left">
                <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                  <Layers size={10} /> {t("admin_label_floor")} (Max)
                </label>
                <input
                  type="number"
                  value={building.floors}
                  onChange={(e) =>
                    onChange({ ...building, floors: parseInt(e.target.value) })
                  }
                  className="mci-input bg-slate-50 border-none rounded-2xl"
                />
              </div>
            </div>

            {/* GPS Koordinaten - responsive unter 500px */}
            <div className="mci-modal-form-group text-left">
              <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                <MapPin size={10} /> {t("admin_field_gps")}
              </label>
              <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-4">
                <input
                  type="number"
                  step="0.0001"
                  value={building.latitude}
                  onChange={(e) =>
                    onChange({
                      ...building,
                      latitude: parseFloat(e.target.value),
                    })
                  }
                  className="mci-input bg-slate-50 border-none rounded-2xl"
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={building.longitude}
                  onChange={(e) =>
                    onChange({
                      ...building,
                      longitude: parseFloat(e.target.value),
                    })
                  }
                  className="mci-input bg-slate-50 border-none rounded-2xl"
                  placeholder="Longitude"
                />
              </div>
            </div>

            {/* WiFi Config */}
            <div className="mci-modal-form-group text-left">
              <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                <Wifi size={10} /> {t("admin_label_wifi_ip")}
              </label>
              <input
                type="text"
                value={building.mci_wifi_ip}
                onChange={(e) =>
                  onChange({ ...building, mci_wifi_ip: e.target.value })
                }
                className="mci-input bg-slate-50 border-none rounded-2xl"
                placeholder="z.B. 138.232"
              />
            </div>

            {/* Barrierefrei - Label im Button, kein Feld-Label */}
            <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 border border-slate-200 transition-all">
              <input
                type="checkbox"
                checked={building.accessible}
                onChange={(e) =>
                  onChange({ ...building, accessible: e.target.checked })
                }
                className="w-5 h-5 rounded cursor-pointer"
              />
              <div className="flex-1 flex items-center gap-2">
                <Accessibility size={16} />
                <span className="font-bold text-sm text-slate-700">
                  {t("label_accessible")}
                </span>
              </div>
            </label>

            {/* Image URL */}
            <div className="mci-modal-form-group text-left">
              <label className="text-[10px] font-black uppercase italic text-slate-400 ml-2 mb-1 flex items-center gap-1">
                <PlusCircle size={10} /> {t("admin_field_image_url")}
              </label>
              <input
                type="url"
                value={building.image_url}
                onChange={(e) =>
                  onChange({ ...building, image_url: e.target.value })
                }
                className="mci-input bg-slate-50 border-none rounded-2xl"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Action Area */}
          <div className="mci-modal-footer">
            <button onClick={onClose} className="mci-modal-btn-secondary">
              {t("archiv_back")}
            </button>

            <button onClick={onSave} className="mci-modal-btn-primary">
              <Save size={18} />
              {t("save_btn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
