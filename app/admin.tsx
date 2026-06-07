import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Status = "pending" | "active" | "suspended" | "rejected";
type Section = "overview" | "pending" | "schools" | "licenses" | "devices" | "audit" | "settings";

type School = {
  id: string;
  school_code: string;
  school_name: string;
  school_id: string;
  supabase_url: string;
  supabase_anon_key: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

type License = {
  license_key: string;
  school_code: string;
  school_id: string;
  school_name: string;
  academic_year: string;
  license_type: "single_term" | "full_year";
  activated_terms: string[];
  max_machines: number;
  registered_hwids: string[];
  is_active: boolean;
  expires_at?: string | null;
  notes?: string;
  updated_at?: string;
};

type Device = {
  id: string;
  license_key: string;
  school_code: string;
  hwid: string;
  academic_year: string;
  term: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  school_code?: string;
  school_name?: string;
  admin_user?: string;
  details?: Record<string, unknown>;
  created_at: string;
};

type Settings = {
  maintenance_mode: boolean;
  maintenance_message: string;
  minimum_desktop_version: string;
  support_message: string;
};

const C = {
  bg: "#0A0F1E",
  header: "#060D1A",
  panel: "#111827",
  card: "#1A2438",
  border: "#1E2E48",
  text: "#F0F6FF",
  muted: "#6B84A8",
  blue: "#1E1EF5",
  blue2: "#1515CC",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#FF4D6A",
  info: "#38BDF8",
};

const YEARS = ["2025/2026", "2026/2027", "2027/2028", "2028/2029", "2029/2030", "2030/2031"];
const TERMS = ["First Term", "Second Term", "Third Term"];

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Request failed.");
  return json;
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<Section>("pending");
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ maintenance_mode: false, maintenance_message: "", minimum_desktop_version: "", support_message: "" });
  const [selectedId, setSelectedId] = useState("");
  const [checks, setChecks] = useState<{ label: string; ok: boolean; message?: string }[]>([]);

  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editAnon, setEditAnon] = useState("");
  const [year, setYear] = useState(YEARS[0]);
  const [licenseType, setLicenseType] = useState<"full_year" | "single_term">("full_year");
  const [term, setTerm] = useState(TERMS[0]);
  const [maxDevices, setMaxDevices] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const selected = schools.find((school) => school.id === selectedId) ?? schools[0];
  const selectedLicenses = selected ? licenses.filter((item) => item.school_code === selected.school_code) : [];
  const latestLicense = selectedLicenses[0];

  useEffect(() => {
    if (selected) {
      setEditName(selected.school_name);
      setEditUrl(selected.supabase_url);
      setEditAnon(selected.supabase_anon_key);
    }
  }, [selected?.id]);

  const filteredSchools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((school) => {
      const inSection =
        section === "pending" ? school.status === "pending" :
        section === "schools" || section === "overview" ? true :
        false;
      const matches = !q || [school.school_name, school.school_code, school.school_id, school.supabase_url].some((value) => String(value || "").toLowerCase().includes(q));
      return inSection && matches;
    });
  }, [query, schools, section]);

  const filteredLicenses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return licenses.filter((license) => !q || [license.school_name, license.school_code, license.license_key, license.academic_year].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [licenses, query]);

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((device) => !q || [device.school_code, device.hwid, device.license_key].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [devices, query]);

  const stats = useMemo(() => ({
    pending: schools.filter((item) => item.status === "pending").length,
    active: schools.filter((item) => item.status === "active").length,
    suspended: schools.filter((item) => item.status === "suspended").length,
    rejected: schools.filter((item) => item.status === "rejected").length,
    activeLicenses: licenses.filter((item) => item.is_active).length,
    expired: licenses.filter((item) => item.expires_at && new Date(item.expires_at).getTime() < Date.now()).length,
    devices: devices.length,
  }), [schools, licenses, devices]);

  const load = async () => {
    setBusy(true);
    try {
      const data = await api("/api/admin-dashboard");
      setSchools(data.schools ?? []);
      setLicenses((data.licenses ?? []).map((item: License) => ({ ...item, activated_terms: listValue(item.activated_terms), registered_hwids: listValue(item.registered_hwids) })));
      setDevices(data.devices ?? []);
      setAudit(data.audit ?? []);
      if (data.settings) setSettings(data.settings);
      setAuthed(true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load dashboard.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const login = async () => {
    setBusy(true);
    try {
      await api("/api/admin-login", { password });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const schoolAction = (action: "approve" | "suspend" | "reactivate" | "reject" | "delete") => {
    if (!selected) return;
    run(async () => {
      await api("/api/admin-school-action", { id: selected.id, action });
      setMessage(`School ${action} complete.`);
    }, "School action failed.");
  };

  const saveSchool = () => {
    if (!selected) return;
    run(async () => {
      await api("/api/admin-school-save", {
        id: selected.id,
        patch: { school_name: editName, supabase_url: editUrl, supabase_anon_key: editAnon },
      });
      setMessage("School details saved.");
    }, "Could not save school.");
  };

  const regenerateCode = () => {
    if (!selected) return;
    run(async () => {
      const data = await api("/api/admin-school-regenerate-code", { id: selected.id });
      await Clipboard.setStringAsync(data.school.school_code);
      setMessage("School code regenerated and copied.");
    }, "Could not regenerate school code.");
  };

  const testConnection = () => {
    if (!selected) return;
    run(async () => {
      const data = await api("/api/admin-test-connection", { school: selected });
      setChecks(data.checks ?? []);
      setMessage("Connection test complete.");
    }, "Connection test failed.");
  };

  const generateLicense = () => {
    if (!selected) return;
    run(async () => {
      const data = await api("/api/admin-license-generate", {
        school: selected,
        academicYear: year,
        licenseType,
        activatedTerms: licenseType === "full_year" ? [] : [term],
        maxDevices: Number(maxDevices || 1),
        expiresAt: expiresAt || null,
        notes,
      });
      await Clipboard.setStringAsync(data.license.license_key);
      setMessage("License generated and copied.");
    }, "License generation failed.");
  };

  const licenseAction = (licenseKey: string, action: "deactivate" | "reactivate" | "clear_devices") => {
    run(async () => {
      await api("/api/admin-license-action", { licenseKey, action });
      setMessage(action === "clear_devices" ? "Registered devices cleared." : "License updated.");
    }, "License action failed.");
  };

  const saveSettings = () => {
    run(async () => {
      await api("/api/admin-settings", { settings });
      setMessage("Platform settings saved.");
    }, "Could not save platform settings.");
  };

  if (!authed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loginShell}>
          <View style={styles.loginCard}>
            <Text style={styles.brand}>SMS Developer Console</Text>
            <Text style={styles.sub}>Central school setup, approvals, devices and licensing</Text>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Admin password" placeholderTextColor={C.muted} style={styles.input} />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Pressable onPress={login} disabled={busy} style={styles.primaryButton}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Sign in</Text>}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <Text style={styles.logo}>SMS Admin</Text>
          <Nav section={section} setSection={setSection} id="overview" label="Overview" badge={stats.pending + stats.expired} />
          <Nav section={section} setSection={setSection} id="pending" label="Pending Schools" badge={stats.pending} />
          <Nav section={section} setSection={setSection} id="schools" label="Schools" badge={schools.length} />
          <Nav section={section} setSection={setSection} id="licenses" label="Licenses" badge={stats.activeLicenses} />
          <Nav section={section} setSection={setSection} id="devices" label="Devices" badge={stats.devices} />
          <Nav section={section} setSection={setSection} id="audit" label="Audit Log" badge={audit.length} />
          <Nav section={section} setSection={setSection} id="settings" label="Settings" />
          <View style={styles.sidebarFooter}>
            <Text style={styles.dim}>API</Text>
            <Text style={styles.online}>smsmobile.vercel.app</Text>
          </View>
        </View>
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.title}>Developer Dashboard</Text>
              <Text style={styles.sub}>Full central console for school setup, licensing and support</Text>
            </View>
            <View style={styles.topActions}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search school, code, license, device" placeholderTextColor={C.muted} style={styles.search} />
              <Pressable onPress={load} style={styles.iconButton}><Ionicons name="refresh" size={18} color={C.text} /></Pressable>
            </View>
          </View>
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {busy ? <Text style={styles.dim}>Working...</Text> : null}
          {section === "overview" ? <Overview stats={stats} schools={schools} licenses={licenses} audit={audit} setSection={setSection} /> : null}
          {section === "pending" || section === "schools" ? (
            <View style={styles.work}>
              <SchoolList schools={filteredSchools} selected={selected} onSelect={setSelectedId} />
              <SchoolDetail
                selected={selected}
                editName={editName}
                setEditName={setEditName}
                editUrl={editUrl}
                setEditUrl={setEditUrl}
                editAnon={editAnon}
                setEditAnon={setEditAnon}
                checks={checks}
                licenses={selectedLicenses}
                onAction={schoolAction}
                onSave={saveSchool}
                onRegenerate={regenerateCode}
                onTest={testConnection}
                onCopy={(value) => Clipboard.setStringAsync(value)}
              />
            </View>
          ) : null}
          {section === "licenses" ? (
            <LicensesView
              licenses={filteredLicenses}
              schools={schools}
              selected={selected}
              year={year}
              setYear={setYear}
              licenseType={licenseType}
              setLicenseType={setLicenseType}
              term={term}
              setTerm={setTerm}
              maxDevices={maxDevices}
              setMaxDevices={setMaxDevices}
              expiresAt={expiresAt}
              setExpiresAt={setExpiresAt}
              notes={notes}
              setNotes={setNotes}
              onGenerate={generateLicense}
              onAction={licenseAction}
              onSelectSchool={setSelectedId}
            />
          ) : null}
          {section === "devices" ? <DevicesView devices={filteredDevices} licenses={licenses} onClear={(key) => licenseAction(key, "clear_devices")} /> : null}
          {section === "audit" ? <AuditView rows={audit} /> : null}
          {section === "settings" ? <SettingsView settings={settings} setSettings={setSettings} onSave={saveSettings} /> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Nav({ section, setSection, id, label, badge }: { section: Section; setSection: (next: Section) => void; id: Section; label: string; badge?: number }) {
  return (
    <Pressable onPress={() => setSection(id)} style={[styles.nav, section === id && styles.navActive]}>
      <Text style={[styles.navText, section === id && styles.navTextActive]}>{label}</Text>
      {badge !== undefined ? <Text style={styles.badge}>{badge}</Text> : null}
    </Pressable>
  );
}

function Overview({ stats, schools, licenses, audit, setSection }: { stats: any; schools: School[]; licenses: License[]; audit: AuditRow[]; setSection: (next: Section) => void }) {
  const pending = schools.filter((item) => item.status === "pending").slice(0, 5);
  const expiring = licenses.filter((item) => item.expires_at).slice(0, 5);
  return (
    <View style={styles.stack}>
      <View style={styles.stats}>
        <Stat label="Pending" value={stats.pending} tone="amber" />
        <Stat label="Active Schools" value={stats.active} tone="green" />
        <Stat label="Suspended" value={stats.suspended} tone="red" />
        <Stat label="Active Licenses" value={stats.activeLicenses} tone="blue" />
        <Stat label="Devices" value={stats.devices} tone="green" />
        <Stat label="Expired" value={stats.expired} tone="red" />
      </View>
      <View style={styles.twoCols}>
        <Panel title="Recent Pending">
          {pending.map((school) => <MiniRow key={school.id} title={school.school_name} detail={school.school_code} action="Review" onPress={() => setSection("pending")} />)}
        </Panel>
        <Panel title="License Watch">
          {expiring.map((license) => <MiniRow key={license.license_key} title={license.school_name} detail={`${license.academic_year} - ${license.expires_at?.slice(0, 10)}`} action="Open" onPress={() => setSection("licenses")} />)}
        </Panel>
      </View>
      <Panel title="Recent Admin Actions">
        {audit.slice(0, 8).map((row) => <MiniRow key={row.id} title={row.action.replaceAll("_", " ")} detail={`${row.school_name || row.school_code || "Platform"} - ${new Date(row.created_at).toLocaleString()}`} />)}
      </Panel>
    </View>
  );
}

function SchoolList({ schools, selected, onSelect }: { schools: School[]; selected?: School; onSelect: (id: string) => void }) {
  return (
    <View style={styles.list}>
      <Text style={styles.sectionTitle}>Schools</Text>
      {schools.map((school) => (
        <Pressable key={school.id} onPress={() => onSelect(school.id)} style={[styles.row, selected?.id === school.id && styles.rowActive]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{school.school_name}</Text>
            <Text style={styles.rowSub}>{school.school_code}</Text>
          </View>
          <StatusPill status={school.status} />
        </Pressable>
      ))}
    </View>
  );
}

function SchoolDetail(props: {
  selected?: School;
  editName: string;
  setEditName: (value: string) => void;
  editUrl: string;
  setEditUrl: (value: string) => void;
  editAnon: string;
  setEditAnon: (value: string) => void;
  checks: { label: string; ok: boolean; message?: string }[];
  licenses: License[];
  onAction: (action: "approve" | "suspend" | "reactivate" | "reject" | "delete") => void;
  onSave: () => void;
  onRegenerate: () => void;
  onTest: () => void;
  onCopy: (value: string) => void;
}) {
  const school = props.selected;
  if (!school) return <View style={styles.detail}><Text style={styles.sub}>No school selected.</Text></View>;
  return (
    <View style={styles.detail}>
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.detailTitle}>{school.school_name}</Text>
          <Text selectable style={styles.code}>{school.school_code}</Text>
        </View>
        <StatusPill status={school.status} />
      </View>
      <View style={styles.actions}>
        {school.status === "pending" ? <Button label="Approve" onPress={() => props.onAction("approve")} /> : null}
        {school.status === "pending" ? <Button label="Reject" danger onPress={() => props.onAction("reject")} /> : null}
        {school.status !== "suspended" ? <Button label="Suspend" danger onPress={() => props.onAction("suspend")} /> : <Button label="Reactivate" onPress={() => props.onAction("reactivate")} />}
        <Button label="Copy Code" onPress={() => props.onCopy(school.school_code)} />
        <Button label="Regenerate Code" onPress={props.onRegenerate} />
        <Button label="Delete" danger onPress={() => props.onAction("delete")} />
      </View>
      <Panel title="Profile">
        <Field label="School name" value={props.editName} onChangeText={props.setEditName} />
        <Field label="Supabase URL" value={props.editUrl} onChangeText={props.setEditUrl} />
        <Field label="Anon key" value={props.editAnon} onChangeText={props.setEditAnon} multiline />
        <Info label="School ID" value={school.school_id} />
        <Button label="Save School Details" onPress={props.onSave} />
      </Panel>
      <Panel title="Connection">
        <Button label="Test Connection" onPress={props.onTest} />
        {props.checks.map((check) => <Text key={check.label} style={check.ok ? styles.ok : styles.bad}>{check.ok ? "OK" : "FAIL"}  {check.label}</Text>)}
      </Panel>
      <Panel title="Licenses">
        {props.licenses.length ? props.licenses.map((license) => <LicenseLine key={license.license_key} license={license} />) : <Text style={styles.sub}>No license generated yet.</Text>}
      </Panel>
    </View>
  );
}

function LicensesView(props: {
  licenses: License[];
  schools: School[];
  selected?: School;
  year: string;
  setYear: (value: string) => void;
  licenseType: "full_year" | "single_term";
  setLicenseType: (value: "full_year" | "single_term") => void;
  term: string;
  setTerm: (value: string) => void;
  maxDevices: string;
  setMaxDevices: (value: string) => void;
  expiresAt: string;
  setExpiresAt: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onGenerate: () => void;
  onAction: (key: string, action: "deactivate" | "reactivate" | "clear_devices") => void;
  onSelectSchool: (id: string) => void;
}) {
  return (
    <View style={styles.work}>
      <Panel title="Generate / Renew" style={styles.list}>
        <Text style={styles.sub}>{props.selected ? props.selected.school_name : "Select a school from the Schools page first."}</Text>
        <Select label="Year" value={props.year} values={YEARS} onChange={props.setYear} />
        <Select label="Type" value={props.licenseType} values={["full_year", "single_term"]} onChange={(value) => props.setLicenseType(value as "full_year" | "single_term")} />
        {props.licenseType === "single_term" ? <Select label="Term" value={props.term} values={TERMS} onChange={props.setTerm} /> : null}
        <Field label="Max devices" value={props.maxDevices} onChangeText={props.setMaxDevices} />
        <Field label="Expires" value={props.expiresAt} onChangeText={props.setExpiresAt} placeholder="YYYY-MM-DD" />
        <Field label="Notes" value={props.notes} onChangeText={props.setNotes} multiline />
        <Button label="Generate / Renew License" onPress={props.onGenerate} />
      </Panel>
      <View style={styles.detail}>
        <Text style={styles.sectionTitle}>Licenses</Text>
        {props.licenses.map((license) => (
          <View key={license.license_key} style={styles.licenseCard}>
            <LicenseLine license={license} />
            <View style={styles.actions}>
              <Button label="Copy" onPress={() => Clipboard.setStringAsync(license.license_key)} />
              {license.is_active ? <Button label="Deactivate" danger onPress={() => props.onAction(license.license_key, "deactivate")} /> : <Button label="Reactivate" onPress={() => props.onAction(license.license_key, "reactivate")} />}
              <Button label="Clear Devices" danger onPress={() => props.onAction(license.license_key, "clear_devices")} />
              {props.schools.find((school) => school.school_code === license.school_code) ? <Button label="Open School" onPress={() => props.onSelectSchool(props.schools.find((school) => school.school_code === license.school_code)!.id)} /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DevicesView({ devices, licenses, onClear }: { devices: Device[]; licenses: License[]; onClear: (key: string) => void }) {
  return (
    <View style={styles.stack}>
      <Panel title="Registered Devices">
        {devices.map((device) => (
          <View key={device.id || `${device.license_key}-${device.hwid}`} style={styles.tableRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{device.school_code}</Text>
              <Text selectable style={styles.rowSub}>{device.hwid}</Text>
            </View>
            <Text style={styles.dim}>{device.academic_year} / {device.term}</Text>
            <Text style={styles.dim}>{new Date(device.last_seen_at).toLocaleString()}</Text>
          </View>
        ))}
      </Panel>
      <Panel title="Device Limits">
        {licenses.map((license) => (
          <View key={license.license_key} style={styles.tableRow}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{license.school_name}</Text>
            <Text style={styles.dim}>{license.registered_hwids.length} / {license.max_machines}</Text>
            <Button label="Clear" danger onPress={() => onClear(license.license_key)} />
          </View>
        ))}
      </Panel>
    </View>
  );
}

function AuditView({ rows }: { rows: AuditRow[] }) {
  return (
    <Panel title="Audit Log">
      {rows.map((row) => (
        <View key={row.id} style={styles.tableRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{row.action.replaceAll("_", " ")}</Text>
            <Text style={styles.rowSub}>{row.school_name || row.school_code || "Platform"}</Text>
          </View>
          <Text style={styles.dim}>{new Date(row.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </Panel>
  );
}

function SettingsView({ settings, setSettings, onSave }: { settings: Settings; setSettings: (next: Settings) => void; onSave: () => void }) {
  return (
    <View style={styles.work}>
      <Panel title="Platform Settings" style={styles.detail}>
        <Pressable onPress={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })} style={[styles.toggle, settings.maintenance_mode && styles.toggleOn]}>
          <Text style={styles.smallText}>Maintenance Mode: {settings.maintenance_mode ? "ON" : "OFF"}</Text>
        </Pressable>
        <Field label="Maintenance message" value={settings.maintenance_message} onChangeText={(value) => setSettings({ ...settings, maintenance_message: value })} multiline />
        <Field label="Minimum desktop version" value={settings.minimum_desktop_version} onChangeText={(value) => setSettings({ ...settings, minimum_desktop_version: value })} />
        <Field label="Support message" value={settings.support_message} onChangeText={(value) => setSettings({ ...settings, support_message: value })} multiline />
        <Button label="Save Platform Settings" onPress={onSave} />
      </Panel>
      <Panel title="System" style={styles.list}>
        <Info label="Platform API" value="https://smsmobile.vercel.app" />
        <Info label="Central Supabase" value="Server-side Vercel variables" />
        <Info label="Admin auth" value="ADMIN_PASSWORD + signed session cookie" />
      </Panel>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "green" | "red" | "blue" }) {
  const color = tone === "amber" ? C.amber : tone === "green" ? C.green : tone === "red" ? C.red : C.info;
  return <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.dim}>{label}</Text></View>;
}

function StatusPill({ status }: { status: Status }) {
  const color = status === "active" ? C.green : status === "pending" ? C.amber : status === "rejected" ? C.muted : C.red;
  return <Text style={[styles.status, { color }]}>{status.toUpperCase()}</Text>;
}

function Button({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.smallButton, danger && styles.dangerButton]}><Text style={styles.smallText}>{label}</Text></Pressable>;
}

function Panel({ title, children, style }: { title: string; children: React.ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function MiniRow({ title, detail, action, onPress }: { title: string; detail: string; action?: string; onPress?: () => void }) {
  return <View style={styles.tableRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSub}>{detail}</Text></View>{action ? <Button label={action} onPress={onPress || (() => undefined)} /> : null}</View>;
}

function LicenseLine({ license }: { license: License }) {
  const terms = license.license_type === "full_year" ? "All terms" : listValue(license.activated_terms).join(", ");
  return <View><Text selectable style={styles.code}>{license.license_key}</Text><Text style={styles.line}>{license.school_name} - {license.academic_year} - {license.license_type}</Text><Text style={styles.dim}>{terms || "No terms"} - Devices {listValue(license.registered_hwids).length}/{license.max_machines} - {license.is_active ? "Active" : "Inactive"}</Text></View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.dim}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>;
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.dim}>{label}</Text><TextInput multiline={multiline} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} style={[styles.miniInput, multiline && styles.multiline]} /></View>;
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (v: string) => void }) {
  return <View style={styles.field}><Text style={styles.dim}>{label}</Text><View style={styles.selectRow}>{values.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.select, value === item && styles.selectActive]}><Text style={styles.selectText}>{item}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  shell: { flex: 1, flexDirection: "row", backgroundColor: C.bg },
  sidebar: { width: 230, backgroundColor: C.header, borderRightColor: C.border, borderRightWidth: 1, padding: 18 },
  logo: { color: C.info, fontSize: 20, fontWeight: "900", marginBottom: 20 },
  nav: { alignItems: "center", borderRadius: 6, flexDirection: "row", justifyContent: "space-between", minHeight: 42, paddingHorizontal: 12, marginBottom: 6 },
  navActive: { backgroundColor: C.blue },
  navText: { color: C.muted, fontWeight: "800" },
  navTextActive: { color: "#FFFFFF" },
  badge: { color: C.info, fontSize: 12, fontWeight: "900" },
  sidebarFooter: { marginTop: "auto", gap: 4 },
  main: { flex: 1 },
  mainContent: { padding: 20, gap: 16 },
  topbar: { alignItems: "center", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  topActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  title: { color: C.text, fontSize: 28, fontWeight: "900" },
  sub: { color: C.muted, fontSize: 13, fontWeight: "600" },
  search: { backgroundColor: C.card, borderColor: C.border, borderRadius: 6, borderWidth: 1, color: C.text, minHeight: 38, paddingHorizontal: 12, width: 320 },
  iconButton: { alignItems: "center", backgroundColor: C.card, borderColor: C.border, borderRadius: 6, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { backgroundColor: C.card, borderColor: C.border, borderRadius: 8, borderWidth: 1, minWidth: 150, padding: 14 },
  statValue: { fontSize: 28, fontWeight: "900" },
  stack: { gap: 16 },
  twoCols: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  work: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  list: { flex: 0.95 },
  detail: { flex: 1.35 },
  panel: { backgroundColor: C.card, borderColor: C.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  sectionTitle: { color: C.info, fontSize: 14, fontWeight: "900", marginBottom: 10, textTransform: "uppercase" },
  row: { alignItems: "center", borderColor: C.border, borderRadius: 6, borderWidth: 1, flexDirection: "row", gap: 10, marginBottom: 8, minHeight: 58, padding: 10 },
  rowActive: { borderColor: C.blue, backgroundColor: "#111D38" },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  detailHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailTitle: { color: C.text, fontSize: 22, fontWeight: "900" },
  code: { color: C.info, fontSize: 13, fontWeight: "900", marginTop: 4 },
  status: { fontSize: 11, fontWeight: "900" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallButton: { backgroundColor: C.blue, borderRadius: 6, minHeight: 34, justifyContent: "center", paddingHorizontal: 12 },
  dangerButton: { backgroundColor: C.red },
  smallText: { color: "#FFFFFF", fontWeight: "900" },
  tableRow: { alignItems: "center", borderTopColor: C.border, borderTopWidth: 1, flexDirection: "row", gap: 12, minHeight: 52, paddingVertical: 10 },
  infoRow: { borderTopColor: C.border, borderTopWidth: 1, gap: 4, paddingVertical: 10 },
  infoValue: { color: C.text, fontSize: 13, fontWeight: "700" },
  line: { color: C.text, fontSize: 13, fontWeight: "800" },
  licenseCard: { borderColor: C.border, borderRadius: 6, borderWidth: 1, gap: 10, padding: 12 },
  field: { gap: 5 },
  miniInput: { backgroundColor: C.bg, borderColor: C.border, borderRadius: 6, borderWidth: 1, color: C.text, minHeight: 38, paddingHorizontal: 10 },
  multiline: { minHeight: 78, paddingTop: 10, textAlignVertical: "top" },
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  select: { borderColor: C.border, borderRadius: 6, borderWidth: 1, minHeight: 34, justifyContent: "center", paddingHorizontal: 10 },
  selectActive: { backgroundColor: C.blue, borderColor: C.blue },
  selectText: { color: C.text, fontSize: 12, fontWeight: "800" },
  toggle: { backgroundColor: C.red, borderRadius: 6, minHeight: 38, justifyContent: "center", paddingHorizontal: 12 },
  toggleOn: { backgroundColor: C.amber },
  ok: { color: C.green, fontWeight: "800" },
  bad: { color: C.red, fontWeight: "800" },
  dim: { color: C.muted, fontSize: 12, fontWeight: "800" },
  online: { color: C.green, fontSize: 12, fontWeight: "800" },
  notice: { backgroundColor: "#10213A", borderColor: C.border, borderRadius: 6, borderWidth: 1, color: C.text, padding: 10 },
  loginShell: { alignItems: "center", flex: 1, justifyContent: "center", padding: 20 },
  loginCard: { backgroundColor: C.card, borderColor: C.border, borderRadius: 8, borderWidth: 1, gap: 12, maxWidth: 420, padding: 22, width: "100%" },
  brand: { color: C.info, fontSize: 24, fontWeight: "900" },
  input: { backgroundColor: C.bg, borderColor: C.border, borderRadius: 6, borderWidth: 1, color: C.text, minHeight: 46, paddingHorizontal: 12 },
  primaryButton: { alignItems: "center", backgroundColor: C.blue, borderRadius: 6, minHeight: 46, justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  error: { color: C.red, fontWeight: "800" },
});
