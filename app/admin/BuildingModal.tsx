"use client";

import { useEffect } from "react";
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
  // modal scroll lock
  useEffect(() => {
    if (show) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [show]);

  if (!show || !building) return null;

  return (
    <div className="mci-modal-overlay animate-in fade-in duration-300">
      <div className="mci-modal-card animate-in zoom-in-95 duration-300">
        {/* Modal CONTAINER mit max-h für Mobile Scroll */}
        <div className="flex flex-col md:flex-row max-h-[90vh] overflow-hidden">
          {/* LEFT SIDE: BILD */}
          <div className="md:w-5/12 bg-slate-100 relative h-[280px] md:h-auto md:min-h-full">
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
            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <p className="text-white/80 text-xs font-bold uppercase flex items-center gap-2"></p>
              <div className="bg-gradient-to-t from-slate-900/80 to-transparent pt-8 -mx-8 -mb-8 px-8 pb-8">
                <h3 className="text-white text-3xl font-black italic uppercase tracking-tighter leading-none">
                  {building.name || "MCI Campus"}
                </h3>
                <p className="text-white/60 text-xs font-bold uppercase mt-2">
                  {t("admin_title_buildings")}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: SCROLLBARES FORMULAR */}
          <div className="md:w-7/12 flex flex-col overflow-hidden">
            {/* HEADER - FIXED */}
            <div className="flex justify-between items-start p-6 md:p-8 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-[#004a87] text-2xl font-black italic uppercase tracking-tight leading-none mb-2">
                  {t("admin_title_buildings")}
                </h2>
                <p className="text-slate-400 text-xs font-black uppercase italic tracking-widest">
                  {building.id ? "ID: " + building.id.slice(0, 8) : "New Building"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-red-500"
              >
                <X size={24} />
              </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="space-y-6">
                {/* Building Name */}
                <div className="mci-modal-form-group">
                  <label className="mci-label">
                    {t("admin_field_name")}
                  </label>
                  <input
                    type="text"
                    value={building.name}
                    onChange={(e) =>
                      onChange({ ...building, name: e.target.value })
                    }
                    className="mci-input"
                    placeholder="z.B. MCI 1"
                  />
                </div>

                {/* Grid: Distance & Floors */}
                <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-4">
                  <div className="mci-modal-form-group">
                    <label className="mci-label">
                      {t("filter_dist")} (Min)
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
                      className="mci-input"
                    />
                  </div>
                  <div className="mci-modal-form-group">
                    <label className="mci-label">
                      {t("admin_label_floor")} (Max)
                    </label>
                    <input
                      type="number"
                      value={building.floors}
                      onChange={(e) =>
                        onChange({ ...building, floors: parseInt(e.target.value) })
                      }
                      className="mci-input"
                    />
                  </div>
                </div>

                {/* GPS Koordinaten */}
                <div className="mci-modal-form-group">
                  <label className="mci-label">
                    {t("admin_field_gps")}
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
                      className="mci-input"
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
                      className="mci-input"
                      placeholder="Longitude"
                    />
                  </div>
                </div>

                {/* WiFi Config */}
                <div className="mci-modal-form-group">
                  <label className="mci-label">
                    {t("admin_label_wifi_ip")}
                  </label>
                  <input
                    type="text"
                    value={building.mci_wifi_ip}
                    onChange={(e) =>
                      onChange({ ...building, mci_wifi_ip: e.target.value })
                    }
                    className="mci-input"
                    placeholder="z.B. 138.232"
                  />
                </div>

                {/* Barrierefrei */}
                <label className="admin-checkbox-card">
                  <input
                    type="checkbox"
                    checked={building.accessible}
                    onChange={(e) =>
                      onChange({ ...building, accessible: e.target.checked })
                    }
                  />
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                    <Accessibility size={16} />
                    {t("label_accessible")}
                  </div>
                </label>

                {/* Image URL */}
                <div className="mci-modal-form-group">
                  <label className="mci-label">
                    {t("admin_field_image_url")}
                  </label>
                  <input
                    type="url"
                    value={building.image_url}
                    onChange={(e) =>
                      onChange({ ...building, image_url: e.target.value })
                    }
                    className="mci-input"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* FOOTER - FIXED */}
            <div className="mci-modal-footer shrink-0">
              <button onClick={onClose} className="btn-mci-secondary">
                {t("archiv_back")}
              </button>
              <button onClick={onSave} className="btn-mci-main">
                <Save size={18} />
                {t("save_btn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}