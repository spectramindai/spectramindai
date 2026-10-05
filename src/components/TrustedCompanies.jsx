export default function TrustedCompanies() {
  const companies = [
    "OpenAI",
    "Microsoft",
    "Google",
    "AWS",
    "GitHub",
    "Slack"
  ];

  return (
    <section className="py-16">
      <p className="text-center text-gray-500 mb-10">
        Trusted by modern companies
      </p>

      <div className="flex flex-wrap justify-center gap-10 text-xl font-semibold text-gray-400">
        {companies.map((company) => (
          <div key={company}>
            {company}
          </div>
        ))}
      </div>
    </section>
  );
}