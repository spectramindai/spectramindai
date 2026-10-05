export default function Pricing() {
  return (
    <section className="py-24 px-8">

      <h2 className="text-4xl font-bold text-center mb-12">
        Pricing
      </h2>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

        <div className="border rounded-2xl p-8">
          <h3 className="text-2xl font-bold">
            Starter
          </h3>

          <p className="text-4xl font-bold mt-4">
            $99
          </p>

          <p className="mt-2 text-gray-600">
            per month
          </p>
        </div>

        <div className="border-2 border-primary rounded-2xl p-8">
          <h3 className="text-2xl font-bold">
            Growth
          </h3>

          <p className="text-4xl font-bold mt-4">
            $299
          </p>

          <p className="mt-2 text-gray-600">
            per month
          </p>
        </div>

        <div className="border rounded-2xl p-8">
          <h3 className="text-2xl font-bold">
            Enterprise
          </h3>

          <p className="text-4xl font-bold mt-4">
            Custom
          </p>

          <p className="mt-2 text-gray-600">
            Contact Sales
          </p>
        </div>

      </div>

    </section>
  );
}