const frameworks = [
  {
    name: "SOC 2",
    description: "Security and trust compliance."
  },
  {
    name: "ISO 27001",
    description: "Information security management."
  },
  {
    name: "CMMC",
    description: "Defense cybersecurity readiness."
  },
  {
    name: "GDPR",
    description: "European privacy regulation."
  }
];

export default function Frameworks() {
  return (
    <section className="py-24 px-8 bg-slate-50">

      <h2 className="text-4xl font-bold text-center mb-4">
        Supported Frameworks
      </h2>

      <p className="text-center text-gray-600 mb-12">
        Start with SOC 2 and expand as your company grows.
      </p>

      <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">

        {frameworks.map((framework) => (
          <div
            key={framework.name}
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition"
          >
            <h3 className="font-bold text-xl">
              {framework.name}
            </h3>

            <p className="mt-3 text-gray-600">
              {framework.description}
            </p>
          </div>
        ))}

      </div>

    </section>
  );
}
