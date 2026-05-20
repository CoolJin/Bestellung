import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { DB } from '../services/db';
import Catalog from './Catalog';
import AdminExtras from './AdminExtras';
import Modal from '../components/Modal';
import { Edit2, Trash2, Search as SearchIcon, ChevronDown, ChevronUp, Eye, EyeOff, Archive, RotateCcw, XCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';

export default function Admin() {
    const { orders, fetchAllData } = useAppContext();
    const [activeTab, setActiveTab] = useState('orders');
    const [users, setUsers] = useState([]);
    const [selectedUserFilter, setSelectedUserFilter] = useState('');
    const [expandedUser, setExpandedUser] = useState(null);
    const [revealedPasswords, setRevealedPasswords] = useState({});
    
    // Order Accordions
    const [openOrderSections, setOpenOrderSections] = useState({ active: true, completed: false, cancelled: false, archived: false });

    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', type: '', data: null });
    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    
    // Admin user create state
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [adminMsg, setAdminMsg] = useState('');

    useEffect(() => {
        fetchAllData();
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const u = await DB.fetchUsers();
        setUsers(u);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await DB.createUser(newUsername, newPassword);
            setAdminMsg('Benutzer erstellt!');
            setNewUsername('');
            setNewPassword('');
            loadUsers();
        } catch(err) {
            setAdminMsg(err.message);
        }
    };

    const handleOrderAction = async (id, status) => {
        await DB.updateOrder(id, { status });
        fetchAllData();
    };
    
    const handleArchiveToggle = async (id, isArchived) => {
        await DB.updateOrder(id, { adminArchived: isArchived });
        fetchAllData();
    };

    const handleDeleteOrder = async (id) => {
        openModal('Bestellung löschen', 'delete_order', { orderId: id });
    };

    const openModal = (title, type, data) => {
        setPw1(''); setPw2(''); setConfirmPw('');
        setModalConfig({ isOpen: true, title, type, data });
    };
    
    const closeModal = () => {
        setModalConfig({ isOpen: false, title: '', type: '', data: null });
    };

    const confirmModal = async () => {
        const { type, data } = modalConfig;
        
        try {
            if (type === 'role_admin' || type === 'role_pablo') {
                const updates = {};
                if (type === 'role_admin') updates.role = data.intendedState ? 'admin' : 'user';
                if (type === 'role_pablo') updates.isPablo = data.intendedState;
                await DB.updateUser(data.username, updates);
            } 
            else if (type === 'edit_pw') {
                if (!pw1 || pw1 !== pw2) {
                    openModal('Fehler', 'pw_error', {});
                    return;
                }
                await DB.updateUser(data.username, { password: pw1 });
            }
            else if (type === 'delete_user') {
                const userObj = users.find(u => u.username === data.username);
                if (confirmPw !== userObj.password) {
                    openModal('Fehler', 'pw_wrong', {});
                    return;
                }
                await DB.deleteUser(data.username);
            }
            else if (type === 'delete_order') {
                await DB.updateOrder(data.orderId, { deletedByAdmin: true });
                fetchAllData();
            }
            else if (type === 'pw_error' || type === 'pw_wrong') {
                closeModal();
                return;
            }
            
            closeModal();
            loadUsers();
        } catch (e) {
            alert('Fehler: ' + e.message);
        }
    };

    const viewUserOrders = (username) => {
        setSelectedUserFilter(username);
        setActiveTab('orders');
    };

    const togglePassword = (username) => {
        setRevealedPasswords(prev => ({ ...prev, [username]: !prev[username] }));
    };

    const toggleSection = (section) => {
        setOpenOrderSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    let allOrders = orders.filter(o => !o.deletedByAdmin).sort((a,b) => new Date(b.date) - new Date(a.date));
    if (selectedUserFilter) {
        allOrders = allOrders.filter(o => o.user === selectedUserFilter);
    }

    const activeOrders = allOrders.filter(o => !o.adminArchived && ['open', 'processing'].includes(o.status));
    const completedOrders = allOrders.filter(o => !o.adminArchived && o.status === 'completed');
    const cancelledOrders = allOrders.filter(o => !o.adminArchived && o.status === 'cancelled');
    const archivedOrders = allOrders.filter(o => o.adminArchived);

    const getStatusLabel = (status) => {
        const map = { open: 'Offen', processing: 'In Bearbeitung', completed: 'Abgeschlossen', cancelled: 'Abgelehnt' };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { open: 'rgba(59,130,246,0.15)', processing: 'rgba(234,179,8,0.15)', completed: 'rgba(34,197,94,0.15)', cancelled: 'rgba(239,68,68,0.15)' };
        return map[status] || 'rgba(255,255,255,0.1)';
    };

    const renderOrderCard = (order) => {
        return (
            <div key={order.id} className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', background: order.adminArchived ? 'rgba(0,0,0,0.4)' : 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {order.id}
                            <span style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem', borderRadius: '4px', background: getStatusColor(order.status), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {getStatusLabel(order.status)}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>{order.user} • {new Date(order.date).toLocaleString('de-DE')}</div>
                    </div>
                    <div style={{ fontWeight: '700', color: 'var(--color-accent)' }}>{Number(order.total || 0).toFixed(2)} €</div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                    {(order.items || []).map((item, idx) => {
                        const productUrl = item.handle ? `https://snuzone.com/products/${item.handle}` : null;
                        return (
                            <div key={idx} style={{ fontSize: '0.875rem', color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {item.quantity}x{' '}
                                    {productUrl ? (
                                        <a href={productUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ color: 'var(--color-foreground)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-foreground)'}
                                        >
                                            {item.name}
                                            <ExternalLink size={10} style={{ opacity: 0.5 }} />
                                        </a>
                                    ) : (
                                        <span style={{ color: 'var(--color-foreground)' }}>{item.name}</span>
                                    )}
                                </span>
                                <span>{Number(item.originalPrice || item.price || 0).toFixed(2)} €/Stk</span>
                            </div>
                        );
                    })}
                </div>
                
                {order.note && (
                    <div style={{ fontSize: '0.875rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                        <strong style={{ color: 'var(--color-accent)' }}>Notiz:</strong> {order.note}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                    
                    {!order.adminArchived && order.status === 'open' && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleOrderAction(order.id, 'processing')}><Clock size={16} /> In Bearbeitung</button>
                            <button className="btn btn-danger" onClick={() => handleOrderAction(order.id, 'cancelled')}><XCircle size={16} /> Ablehnen</button>
                        </>
                    )}

                    {!order.adminArchived && order.status === 'processing' && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.25rem' }}>
                                <button className="btn btn-primary" onClick={() => handleOrderAction(order.id, 'completed')}><CheckCircle size={16} /> Abschließen</button>
                                <button className="btn btn-secondary" style={{ padding: '0 0.5rem' }} onClick={() => handleOrderAction(order.id, 'open')} title="Zurück zu Offen"><RotateCcw size={16} /></button>
                            </div>
                            <button className="btn btn-danger" onClick={() => handleOrderAction(order.id, 'cancelled')}><XCircle size={16} /> Ablehnen</button>
                        </>
                    )}

                    {!order.adminArchived && (order.status === 'completed' || order.status === 'cancelled') && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleArchiveToggle(order.id, true)}><Archive size={16} /> Archivieren</button>
                        </>
                    )}

                    {!order.adminArchived && order.status === 'completed' && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleOrderAction(order.id, 'processing')} title="Zurück in Bearbeitung"><RotateCcw size={16} /> Rückgängig</button>
                        </>
                    )}

                    {!order.adminArchived && order.status === 'cancelled' && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleOrderAction(order.id, 'open')}><RotateCcw size={16} /> Erneut öffnen</button>
                            <button className="btn btn-danger" onClick={() => handleDeleteOrder(order.id)} style={{ marginLeft: 'auto' }}><Trash2 size={16} /> Löschen</button>
                        </>
                    )}

                    {order.adminArchived && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleArchiveToggle(order.id, false)}><RotateCcw size={16} /> Wiederherstellen</button>
                            <button className="btn btn-danger" onClick={() => handleDeleteOrder(order.id)} style={{ marginLeft: 'auto' }}><Trash2 size={16} /> Löschen</button>
                        </>
                    )}

                </div>
            </div>
        );
    };

    const renderModalContent = () => {
        const { type, data } = modalConfig;
        if (type === 'role_admin') return <p>Soll <strong>{data?.username}</strong> Administrator {data?.intendedState ? 'werden' : 'nicht mehr sein'}?</p>;
        if (type === 'role_pablo') return <p>Pablo Flatrate für <strong>{data?.username}</strong> {data?.intendedState ? 'aktivieren' : 'deaktivieren'}?</p>;
        if (type === 'delete_order') return <p>Bestellung <strong>{data?.orderId}</strong> wirklich komplett löschen?</p>;
        if (type === 'pw_error') return <p style={{ color: 'var(--color-destructive)' }}>Passwörter stimmen nicht überein.</p>;
        if (type === 'pw_wrong') return <p style={{ color: 'var(--color-destructive)' }}>Falsches Passwort — Benutzer nicht gelöscht.</p>;
        if (type === 'edit_pw') return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p>Neues Passwort für <strong>{data?.username}</strong> festlegen:</p>
                <input type="password" placeholder="Neues Passwort" value={pw1} onChange={e=>setPw1(e.target.value)} className="form-input" />
                <input type="password" placeholder="Passwort Bestätigen" value={pw2} onChange={e=>setPw2(e.target.value)} className="form-input" />
            </div>
        );
        if (type === 'delete_user') return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p>Möchten Sie den Benutzer <strong>{data?.username}</strong> wirklich löschen?</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-destructive)' }}>Bitte geben Sie zur Bestätigung das <strong>aktuelle Passwort</strong> dieses Benutzers ein.</p>
                <input type="text" placeholder="Passwort eingeben" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} className="form-input" />
            </div>
        );
        return null;
    };

    return (
        <div className="container" style={{ paddingBottom: '6rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>Dashboard</h1>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                <button className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('orders')}>Bestellungen</button>
                <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('users')}>Benutzer</button>
                <button className={`btn ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('search')}>Suche</button>
                <button className={`btn ${activeTab === 'extras' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('extras')}>Extras</button>
            </div>

            {activeTab === 'extras' && (
                <div style={{ marginTop: '-1rem' }}>
                    <AdminExtras />
                </div>
            )}

            {activeTab === 'search' && (
                <div style={{ marginTop: '-1rem' }}>
                    <Catalog mode="extras" />
                </div>
            )}

            {activeTab === 'orders' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedUserFilter && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)' }}>
                            <span style={{ fontSize: '0.875rem' }}>Filter aktiv: <strong>{selectedUserFilter}</strong></span>
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setSelectedUserFilter('')}>Filter aufheben</button>
                        </div>
                    )}

                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => toggleSection('active')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontWeight: '600' }}>Aktive Bestellungen ({activeOrders.length})</h3>
                            {openOrderSections.active ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                    {openOrderSections.active && (
                        <div style={{ paddingLeft: '0.5rem' }}>
                            {activeOrders.map(renderOrderCard)}
                            {activeOrders.length === 0 && <p className="text-muted text-center" style={{ padding: '1rem' }}>Keine aktiven Bestellungen.</p>}
                        </div>
                    )}

                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => toggleSection('completed')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontWeight: '600' }}>Abgeschlossen ({completedOrders.length})</h3>
                            {openOrderSections.completed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                    {openOrderSections.completed && (
                        <div style={{ paddingLeft: '0.5rem' }}>
                            {completedOrders.map(renderOrderCard)}
                            {completedOrders.length === 0 && <p className="text-muted text-center" style={{ padding: '1rem' }}>Keine abgeschlossenen Bestellungen.</p>}
                        </div>
                    )}

                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => toggleSection('cancelled')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontWeight: '600' }}>Storniert ({cancelledOrders.length})</h3>
                            {openOrderSections.cancelled ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                    {openOrderSections.cancelled && (
                        <div style={{ paddingLeft: '0.5rem' }}>
                            {cancelledOrders.map(renderOrderCard)}
                            {cancelledOrders.length === 0 && <p className="text-muted text-center" style={{ padding: '1rem' }}>Keine stornierten Bestellungen.</p>}
                        </div>
                    )}

                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => toggleSection('archived')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontWeight: '600' }}>Archiviert ({archivedOrders.length})</h3>
                            {openOrderSections.archived ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                    {openOrderSections.archived && (
                        <div style={{ paddingLeft: '0.5rem' }}>
                            {archivedOrders.map(renderOrderCard)}
                            {archivedOrders.length === 0 && <p className="text-muted text-center" style={{ padding: '1rem' }}>Archiv leer.</p>}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Benutzer erstellen</h3>
                        <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Username</label>
                                <input type="text" className="form-input" value={newUsername} onChange={e=>setNewUsername(e.target.value)} required/>
                            </div>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Passwort</label>
                                <input type="text" className="form-input" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ height: '39px' }}>Erstellen</button>
                        </form>
                        {adminMsg && <div style={{ color: adminMsg.includes('erstellt') ? 'var(--color-accent)' : 'var(--color-destructive)', fontSize: '0.875rem', marginTop: '1rem' }}>{adminMsg}</div>}
                    </div>

                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Nutzerverwaltung</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {users.map(u => {
                                const isExpanded = expandedUser === u.username;
                                return (
                                    <div key={u.username} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-primary)', overflow: 'hidden' }}>
                                        <div 
                                            style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                                            onClick={() => setExpandedUser(isExpanded ? null : u.username)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontWeight: '600' }}>{u.username}</span>
                                                {u.role === 'admin' && <span style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</span>}
                                            </div>
                                            <div style={{ color: 'var(--color-muted)' }}>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>Passwort:</span>
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', letterSpacing: revealedPasswords[u.username] ? 'normal' : '0.2em' }}>
                                                                {revealedPasswords[u.username] ? u.password : '••••••••'}
                                                            </span>
                                                        </div>
                                                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => togglePassword(u.username)}>
                                                            {revealedPasswords[u.username] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                        </button>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={u.role === 'admin'} onChange={(e) => openModal('Rolle ändern', 'role_admin', { username: u.username, intendedState: e.target.checked })} />
                                                            Administrator
                                                        </label>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={u.isPablo} onChange={(e) => openModal('Rolle ändern', 'role_pablo', { username: u.username, intendedState: e.target.checked })} />
                                                            Pablo Flatrate
                                                        </label>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <button className="btn btn-secondary" onClick={() => openModal('Passwort ändern', 'edit_pw', { username: u.username })}>
                                                            <Edit2 size={14} /> Passwort
                                                        </button>
                                                        <button className="btn btn-secondary" onClick={() => viewUserOrders(u.username)}>
                                                            <SearchIcon size={14} /> Bestellungen
                                                        </button>
                                                        <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => openModal('Benutzer löschen', 'delete_user', { username: u.username })}>
                                                            <Trash2 size={14} /> Löschen
                                                        </button>
                                                    </div>

                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <Modal 
                isOpen={modalConfig.isOpen} 
                title={modalConfig.title}
                onClose={closeModal}
                onConfirm={confirmModal}
                isDanger={modalConfig.type === 'delete_user'}
            >
                {renderModalContent()}
            </Modal>
        </div>
    );
}
