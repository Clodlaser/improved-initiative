import * as React from "react";

import { Spell } from "../../common/Spell";
import { SubmitButton } from "../Components/Button";
import { SpellDetails } from "../Library/Components/SpellDetails";
import { PromptProps } from "./PendingPrompts";
import { Listing } from "../Library/Listing";
import { Listable } from "../../common/Listable";

export function SpellPrompt(
  spellListing: Listing<Spell>
): PromptProps<Record<string, never>> {
  return {
    autoFocusSelector: "button",
    children: <SpellPromptComponent spellListing={spellListing} />,
    initialValues: {},
    onSubmit: () => true
  };
}

function SpellPromptComponent(props: {
  spellListing: Listing<Spell>;
}): React.ReactElement {
  const [spell, loading, error] = useAsyncListing(props.spellListing);

  if (error) {
    return (
      <div className="prompt-spell">
        <div className="spell">
          <h3>{props.spellListing.Meta().Name}</h3>
          <p>Error loading spell: {error}</p>
        </div>
        <SubmitButton />
      </div>
    );
  }
  
  if (loading || !spell) {
    return (
      <div className="prompt-spell">
        <div className="spell">
          <h3>{props.spellListing.Meta().Name}</h3>
          <p>Loading...</p>
        </div>
        <SubmitButton />
      </div>
    );
  }

  return (
    <div className="prompt-spell">
      <SpellDetails Spell={spell} />
      <SubmitButton />
    </div>
  );
}

function useAsyncListing<T extends Listable>(
  listing: Listing<T>
): [T | undefined, boolean, string | null] {
  const [data, setData] = React.useState<T | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listing.GetAsyncWithUpdatedId((item: T) => {
      setLoading(false);
      if (!item) {
        setError("Item not found");
      } else {
        setData(item);
      }
    });
  }, [listing]);

  return [data, loading, error];
}
