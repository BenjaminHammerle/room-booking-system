"use client";

// react components

import { X, Save, ShieldCheck, UserPlus } from "lucide-react";

interface EditUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  is_admin: boolean;
}

interface NewUser {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  is_admin: boolean;
}

interface UserModalsProps {
  showEdit: boolean;
  showAdd: boolean;
  editUser: EditUser | null;
  newUser: NewUser;
  onCloseEdit: () => void;
  onCloseAdd: () => void;
  onUpdateUser: () => void;
  onCreateUser: (e: React.FormEvent) => void;
  onEditChange: (user: EditUser) => void;
  onNewChange: (user: NewUser) => void;
  t: (key: string) => string;
}

// user modals komponente (bearbeiten + hinzufügen)
export default function UserModals({
  showEdit,
  showAdd,
  editUser,
  newUser,
  onCloseEdit,
  onCloseAdd,
  onUpdateUser,
  onCreateUser,
  onEditChange,
  onNewChange,
  t,
}: UserModalsProps) {
  return (
    <>
      {/* user ändern modal */}
      {showEdit && editUser && (
        <div className="rbs-modal-overlay">
          <div className="rbs-modal-card max-w-2xl">
            <div className="flex flex-col max-h-[90vh] overflow-hidden">
              <div className="rbs-modal-header shrink-0">
                <div>
                  <p className="rbs-modal-subtitle">
                    {t("admin_sidebar_users")}
                  </p>
                  <h3 className="rbs-modal-title">
                    {editUser.first_name} {editUser.last_name}
                  </h3>
                </div>
                <button onClick={onCloseEdit} className="rbs-modal-close">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="space-y-6">
                  <div className="rbs-modal-form-grid">
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_fname")} *
                      </label>
                      <input
                        type="text"
                        value={editUser.first_name}
                        onChange={(e) => onEditChange({ ...editUser, first_name: e.target.value })}
                        className="rbs-input"
                      />
                    </div>
                    
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_lname")} *
                      </label>
                      <input
                        type="text"
                        value={editUser.last_name}
                        onChange={(e) => onEditChange({ ...editUser, last_name: e.target.value })}
                        className="rbs-input"
                      />
                    </div>
                  </div>
                  
                  <div className="rbs-modal-form-group">
                    <label className="rbs-label">{t("admin_label_email")} *</label>
                    <input
                      type="email"
                      value={editUser.email}
                      onChange={(e) => onEditChange({ ...editUser, email: e.target.value })}
                      className="rbs-input"
                    />
                  </div>
                  
                  <div className="rbs-modal-form-group">
                    <label className="rbs-label">
                      {t("admin_label_password")} (optional)
                    </label>
                    <input
                      type="password"
                      onChange={(e) => onEditChange({ ...editUser, password: e.target.value })}
                      className="rbs-input"
                    />
                  </div>

                  <label className="admin-checkbox-card">
                    <input
                      type="checkbox"
                      checked={editUser.is_admin}
                      onChange={(e) => onEditChange({ ...editUser, is_admin: e.target.checked })}
                    />
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                      <ShieldCheck size={18} />
                      {t("admin_label_admin")}
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="rbs-modal-footer shrink-0">
                <button onClick={onCloseEdit} className="rbs-modal-btn-secondary">
                  {t("archiv_back")}
                </button>
                <button onClick={onUpdateUser} className="rbs-btn-main">
                  <Save size={20} />
                  {t("save_btn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* user hinzufügen modal */}
      {showAdd && (
        <div className="rbs-modal-overlay">
          <div className="rbs-modal-card max-w-2xl">
            <form onSubmit={onCreateUser}>
              <div className="flex flex-col max-h-[90vh] overflow-hidden">
                <div className="rbs-modal-header shrink-0">
                  <div>
                    <p className="rbs-modal-subtitle">
                      {t("admin_sidebar_users")}
                    </p>
                    <h3 className="rbs-modal-title">
                      {t("admin_modal_add_user_title")}
                    </h3>
                  </div>
                  <button type="button" onClick={onCloseAdd} className="rbs-modal-close">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 md:p-10">
                  <div className="space-y-6">
                    <div className="rbs-modal-form-grid">
                      <div className="rbs-modal-form-group">
                        <label className="rbs-label">
                          {t("admin_label_fname")} *
                        </label>
                        <input
                          required
                          type="text"
                          value={newUser.first_name}
                          onChange={(e) => onNewChange({ ...newUser, first_name: e.target.value })}
                          className="rbs-input"
                        />
                      </div>
                      
                      <div className="rbs-modal-form-group">
                        <label className="rbs-label">
                          {t("admin_label_lname")} *
                        </label>
                        <input
                          required
                          type="text"
                          value={newUser.last_name}
                          onChange={(e) => onNewChange({ ...newUser, last_name: e.target.value })}
                          className="rbs-input"
                        />
                      </div>
                    </div>
                    
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">{t("admin_label_email")} *</label>
                      <input
                        required
                        type="email"
                        value={newUser.email}
                        onChange={(e) => onNewChange({ ...newUser, email: e.target.value })}
                        className="rbs-input"
                      />
                    </div>
                    
                    <div className="rbs-modal-form-group">
                      <label className="rbs-label">
                        {t("admin_label_password")} *
                      </label>
                      <input
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) => onNewChange({ ...newUser, password: e.target.value })}
                        className="rbs-input"
                      />
                    </div>
                    
                    <label className="admin-checkbox-card">
                      <input
                        type="checkbox"
                        checked={newUser.is_admin}
                        onChange={(e) => onNewChange({ ...newUser, is_admin: e.target.checked })}
                      />
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                        <ShieldCheck size={18} />
                        {t("admin_label_admin")}
                      </div>
                    </label>
                  </div>
                </div>
                
                <div className="rbs-modal-footer shrink-0">
                  <button type="button" onClick={onCloseAdd} className="rbs-modal-btn-secondary">
                    {t("archiv_back")}
                  </button>
                  <button type="submit" className="rbs-btn-main">
                    <UserPlus size={20} />
                    {t("admin_btn_add_user")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}