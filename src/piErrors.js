// Local dictionary. Everything is bundled, nothing is fetched.
// To add a code: key is the code as it appears in the log ('-10722', '0x800706BA' with uppercase hex,
// or 'WSA<number>' for Winsock). Verify new entries against the AVEVA PI error code reference.

export const PI_ERRORS = {
  // ---------- PI (PINET / secure objects) ----------
  '-10722': {
    label: '-10722',
    title: 'PINET: Timeout on PI RPC or system call',
    severity: 'error',
    meaning: 'The interface sent a request to the PI Data Archive or PI Buffer Subsystem and did not get a reply in time.',
    fix: 'Check latency and packet loss between the interface node and PI server, firewall rules for TCP 5450, PI server load, and that pinetmgr is responsive.',
  },
  '-10401': {
    label: '-10401',
    title: 'No Read Access - Secure Object',
    severity: 'error',
    meaning: 'The identity the interface connects as has no read permission on the PI point or secured object it requested.',
    fix: 'Verify the PI Mapping or Trust for the interface service account, then review point and database security (DataAccess / PtAccess) in PI SMT.',
  },
  '-10402': {
    label: '-10402',
    title: 'No Write Access - Secure Object',
    severity: 'error',
    meaning: 'The identity the interface connects as has no write permission on the PI point or secured object.',
    fix: 'Grant write access to the interface identity on the point (DataAccess / PtAccess) and confirm the Trust or Mapping resolves to that identity.',
  },

  // ---------- OPC DA / COM / DCOM ----------
  '0x800706BA': {
    label: '0x800706BA',
    title: 'RPC server is unavailable',
    severity: 'error',
    meaning: 'DCOM could not reach the OPC server host: host down, OPC service stopped, blocked RPC/DCOM ports, or name resolution failure.',
    fix: 'Resolve and ping the OPC host, confirm the OPC server service is running, allow TCP 135 plus the DCOM dynamic port range, and recheck dcomcnfg.',
  },
  '0x800706BE': {
    label: '0x800706BE',
    title: 'RPC call failed',
    severity: 'error',
    meaning: 'An established connection to the OPC server dropped mid-call, usually because the server crashed or the network glitched.',
    fix: 'Check the OPC server for crashes or restarts around this timestamp and review network stability between the two nodes.',
  },
  '0x80070005': {
    label: '0x80070005',
    title: 'Access denied (E_ACCESSDENIED)',
    severity: 'error',
    meaning: 'DCOM security rejected the interface. The account does not have launch, activation or access permission on the OPC server.',
    fix: 'In dcomcnfg, grant the interface account Launch/Activation and Access permissions on the OPC server, and check that the account exists and matches on both hosts.',
  },
  '0x80040154': {
    label: '0x80040154',
    title: 'Class not registered (REGDB_E_CLASSNOTREG)',
    severity: 'error',
    meaning: 'The OPC server ProgID/CLSID is not registered on the target machine, OPC Core Components are missing, or there is a 32/64-bit mismatch.',
    fix: 'Confirm the OPC server is installed on the target host, install the OPC Core Components redistributable, and check bitness of interface vs server.',
  },
  '0x80080005': {
    label: '0x80080005',
    title: 'Server execution failed (CO_E_SERVER_EXEC_FAILURE)',
    severity: 'error',
    meaning: 'DCOM found the OPC server but could not start its process.',
    fix: 'Start the OPC server manually to see its own errors, review the Identity tab in dcomcnfg, and check for session/desktop restrictions.',
  },
  '0xC0040001': {
    label: '0xC0040001',
    title: 'OPC_E_INVALIDHANDLE',
    severity: 'error',
    meaning: 'The server or item handle is not valid, often left over after a reconnect or server restart.',
    fix: 'Restart the interface so groups and items are recreated against the current server session.',
  },
  '0xC0040004': {
    label: '0xC0040004',
    title: 'OPC_E_BADTYPE',
    severity: 'error',
    meaning: 'The requested data type cannot be converted to the item native type.',
    fix: 'Check the point data type and the interface requested type against the OPC item canonical type.',
  },
  '0xC0040006': {
    label: '0xC0040006',
    title: 'OPC_E_BADRIGHTS',
    severity: 'error',
    meaning: 'The item does not allow the attempted operation, for example writing to a read-only item.',
    fix: 'Check the item access rights on the OPC server and whether the point is configured for output on a read-only item.',
  },
  '0xC0040007': {
    label: '0xC0040007',
    title: 'OPC_E_UNKNOWNITEMID',
    severity: 'error',
    meaning: 'The item ID is not in the OPC server address space.',
    fix: 'Check the point Location/InstrumentTag/ItemID for typos or removed items, and browse the server address space to confirm the exact name.',
  },
  '0xC0040008': {
    label: '0xC0040008',
    title: 'OPC_E_INVALIDITEMID',
    severity: 'error',
    meaning: 'The item ID syntax is not valid for this OPC server.',
    fix: 'Compare the item ID format against the OPC server vendor documentation.',
  },

  // ---------- Winsock ----------
  WSA10048: {
    label: 'Winsock 10048',
    title: 'Address already in use',
    severity: 'error',
    meaning: 'Another process is already bound to the port the interface is trying to use.',
    fix: 'Find the conflicting process with netstat -ano and stop it or change the port.',
  },
  WSA10051: {
    label: 'Winsock 10051',
    title: 'Network is unreachable',
    severity: 'error',
    meaning: 'There is no route to the network the target host is on.',
    fix: 'Check routing tables, VLAN/subnet configuration and the gateway on the interface node.',
  },
  WSA10053: {
    label: 'Winsock 10053',
    title: 'Connection aborted by local software',
    severity: 'error',
    meaning: 'The local host aborted the connection, often due to a timeout or a security/AV component.',
    fix: 'Check local firewall or endpoint security logs and any retransmission timeouts on the link.',
  },
  WSA10054: {
    label: 'Winsock 10054',
    title: 'Connection reset by peer',
    severity: 'error',
    meaning: 'The remote side forcibly closed the connection: service restart, crash, or a firewall/device dropping the session.',
    fix: 'Check the remote service state and any firewall or idle-session timeouts between the two hosts.',
  },
  WSA10060: {
    label: 'Winsock 10060',
    title: 'Connection timed out',
    severity: 'error',
    meaning: 'The remote host did not answer. It may be down, unreachable, or a firewall is silently dropping packets.',
    fix: 'Test the port from the interface node (Test-NetConnection host -Port n), and check firewall rules and routing.',
  },
  WSA10061: {
    label: 'Winsock 10061',
    title: 'Connection refused',
    severity: 'error',
    meaning: 'The host is reachable but nothing is listening on that port, or a device is actively rejecting the connection.',
    fix: 'Confirm the target service is running and listening (PI Network Manager defaults to TCP 5450) and check firewall rules.',
  },
  WSA10065: {
    label: 'Winsock 10065',
    title: 'No route to host',
    severity: 'error',
    meaning: 'The network path to the host does not exist or the host is unreachable.',
    fix: 'Verify IP/subnet settings, gateways and firewall zones between the nodes.',
  },
}

export function normalizeCode(text) {
  return /^0x/i.test(text) ? '0x' + text.slice(2).toUpperCase() : text
}
