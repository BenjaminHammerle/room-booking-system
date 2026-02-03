"use client";

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
      {/* EDIT USER MODAL */}
      {showEdit && editUser && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-2xl">
            {/* Modal mit max-h für Scroll */}
            <div className="flex flex-col max-h-[90vh] overflow-hidden">
              {/* HEADER - FIXED */}
              <div className="mci-modal-header shrink-0">
                <div>
                  <p className="mci-modal-subtitle">
                    {t("admin_sidebar_users")}
                  </p>
                  <h3 className="mci-modal-title">
                    {editUser.first_name} {editUser.last_name}
                  </h3>
                </div>
                <button onClick={onCloseEdit} className="mci-modal-close">
                  <X size={24} />
                </button>
              </div>
              
              {/* SCROLLABLE CONTENT */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="space-y-6">
                  <div className="mci-modal-form-grid">
                    <div className="mci-modal-form-group">
                      <label className="mci-label">
                        {t("admin_label_fname")} *
                      </label>
                      <input
                        type="text"
                        value={editUser.first_name}
                        onChange={(e) => onEditChange({ ...editUser, first_name: e.target.value })}
                        className="mci-input"
                      />
                    </div>
                    
                    <div className="mci-modal-form-group">
                      <label className="mci-label">
                        {t("admin_label_lname")} *
                      </label>
                      <input
                        type="text"
                        value={editUser.last_name}
                        onChange={(e) => onEditChange({ ...editUser, last_name: e.target.value })}
                        className="mci-input"
                      />
                    </div>
                  </div>
                  
                  <div className="mci-modal-form-group">
                    <label className="mci-label">{t("admin_label_email")} *</label>
                    <input
                      type="email"
                      value={editUser.email}
                      onChange={(e) => onEditChange({ ...editUser, email: e.target.value })}
                      className="mci-input"
                    />
                  </div>
                  
                  <div className="mci-modal-form-group">
                    <label className="mci-label">
                      {t("admin_label_password")} (optional)
                    </label>
                    <input
                      type="password"
                      onChange={(e) => onEditChange({ ...editUser, password: e.target.value })}
                      className="mci-input"
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
              
              {/* FOOTER - FIXED */}
              <div className="mci-modal-footer shrink-0">
                <button onClick={onCloseEdit} className="btn-mci-secondary">
                  {t("archiv_back")}
                </button>
                <button onClick={onUpdateUser} className="btn-mci-main">
                  <Save size={20} />
                  {t("save_btn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAdd && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-2xl">
            <form onSubmit={onCreateUser}>
              {/* Modal mit max-h für Scroll */}
              <div className="flex flex-col max-h-[90vh] overflow-hidden">
                {/* HEADER - FIXED */}
                <div className="mci-modal-header shrink-0">
                  <div>
                    <p className="mci-modal-subtitle">
                      {t("admin_sidebar_users")}
                    </p>
                    <h3 className="mci-modal-title">
                      {t("admin_modal_add_user_title")}
                    </h3>
                  </div>
                  <button type="button" onClick={onCloseAdd} className="mci-modal-close">
                    <X size={24} />
                  </button>
                </div>
                
                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10">
                  <div className="space-y-6">
                    <div className="mci-modal-form-grid">
                      <div className="mci-modal-form-group">
                        <label className="mci-label">
                          {t("admin_label_fname")} *
                        </label>
                        <input
                          required
                          type="text"
                          value={newUser.first_name}
                          onChange={(e) => onNewChange({ ...newUser, first_name: e.target.value })}
                          className="mci-input"
                        />
                      </div>
                      
                      <div className="mci-modal-form-group">
                        <label className="mci-label">
                          {t("admin_label_lname")} *
                        </label>
                        <input
                          required
                          type="text"
                          value={newUser.last_name}
                          onChange={(e) => onNewChange({ ...newUser, last_name: e.target.value })}
                          className="mci-input"
                        />
                      </div>
                    </div>
                    
                    <div className="mci-modal-form-group">
                      <label className="mci-label">{t("admin_label_email")} *</label>
                      <input
                        required
                        type="email"
                        value={newUser.email}
                        onChange={(e) => onNewChange({ ...newUser, email: e.target.value })}
                        className="mci-input"
                      />
                    </div>
                    
                    <div className="mci-modal-form-group">
                      <label className="mci-label">
                        {t("admin_label_password")} *
                      </label>
                      <input
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) => onNewChange({ ...newUser, password: e.target.value })}
                        className="mci-input"
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
                
                {/* FOOTER - FIXED */}
                <div className="mci-modal-footer shrink-0">
                  <button type="button" onClick={onCloseAdd} className="btn-mci-secondary">
                    {t("archiv_back")}
                  </button>
                  <button type="submit" className="btn-mci-main">
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