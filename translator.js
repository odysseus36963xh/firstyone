window.fakeTranslate = async function(text, lang) {

  const dict = {

    es: {
      hello: "hola",
      "thank you": "gracias",
      "good night": "buenas noches",
      "good morning": "buenos días"
    },

    fr: {
      hello: "bonjour",
      "thank you": "merci"
    },

    de: {
      hello: "hallo",
      "thank you": "danke"
    }
  };

  const lower = text.toLowerCase().trim();

  return (
    dict[lang]?.[lower]
    || "[" + lang + "] " + text
  );
};
