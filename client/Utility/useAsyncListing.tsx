import * as React from "react";
import { Listing } from "../Library/Listing";
import { Listable } from "../../common/Listable";

export function useAsyncListing<T extends Listable>(
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
