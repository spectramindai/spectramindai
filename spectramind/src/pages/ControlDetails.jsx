import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

import { useParams } from "react-router-dom";
import { controls } from "../data/controls";

export default function ControlDetails() {

  const { id } = useParams();

  const control = controls.find(
    (c) => c.id === id
  );

  if (!control) {
    return (
      <div className="p-10 text-black dark:text-white bg-slate-100 dark:bg-slate-900 min-h-screen">
        Control not found
      </div>
    );
  }

  return (
    <div className="flex">

      <Sidebar />

      <div className="flex-1 bg-slate-100 dark:bg-slate-900 min-h-screen">

        <Topbar />

        <div className="p-8">

          <h1 className="text-4xl font-bold text-black dark:text-white">
            {control.id} {control.name}
          </h1>

          <p className="text-gray-500 dark:text-gray-300 mt-2">
            Security controls for user access management.
          </p>

          {/* Status */}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-8">

            <h2 className="font-bold text-xl mb-4 text-black dark:text-white">
              Status
            </h2>

            <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full">
              {control.status}
            </span>

          </div>

          {/* Owner */}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-6">

            <h2 className="font-bold text-xl mb-4 text-black dark:text-white">
              Owner
            </h2>

            <p className="text-black dark:text-white">
              {control.owner}
            </p>

          </div>

          {/* Evidence */}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-6">

            <h2 className="font-bold text-xl mb-4 text-black dark:text-white">
              Evidence
            </h2>

            <ul className="space-y-2 text-black dark:text-white">

              <li>✓ Access Review.pdf</li>

              <li>✓ IAM Audit.xlsx</li>

              <li>✓ User Permissions Report.pdf</li>

            </ul>

          </div>

          {/* Risks */}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-6">

            <h2 className="font-bold text-xl mb-4 text-black dark:text-white">
              Related Risks
            </h2>

            <ul className="text-black dark:text-white">

              <li>
                {control.risk}
              </li>

            </ul>

          </div>

          {/* AI Recommendation */}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-6">

            <h2 className="font-bold text-xl mb-4 text-black dark:text-white">
              AI Recommendation
            </h2>

            <p className="text-black dark:text-white">
              {control.recommendation}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}