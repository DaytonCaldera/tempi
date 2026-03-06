export default function TaskTable() {
  const dummyTasks = [
    { id: "01", title: "Initialize Core Engine", status: "Completed", priority: "High" },
    { id: "02", title: "Sync MongoDB Handshake", status: "In Progress", priority: "Critical" },
    { id: "03", title: "Deploy Edge Middleware", status: "Pending", priority: "Medium" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="p-4 text-sm font-medium text-purple-400 uppercase tracking-widest">ID</th>
            <th className="p-4 text-sm font-medium text-purple-400 uppercase tracking-widest">Task</th>
            <th className="p-4 text-sm font-medium text-purple-400 uppercase tracking-widest">Priority</th>
            <th className="p-4 text-sm font-medium text-purple-400 uppercase tracking-widest text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {dummyTasks.map((task) => (
            <tr key={task.id} className="group hover:bg-white/[0.1] transition-colors">
              <td className="p-4 font-mono text-gray-500">{task.id}</td>
              <td className="p-4 font-medium">{task.title}</td>
              <td className="p-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  task.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-gray-400'
                }`}>
                  {task.priority}
                </span>
              </td>
              <td className="p-4 text-right">
                <span className="text-sm text-gray-300 group-hover:text-purple-400 transition-colors">
                  {task.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}