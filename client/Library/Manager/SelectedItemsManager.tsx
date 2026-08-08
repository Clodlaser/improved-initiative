import * as React from "react";
import { saveAs } from "browser-filesaver";
import { useState } from "react";
import { LibrariesCommander } from "../../Commands/LibrariesCommander";
import { Listable } from "../../../common/Listable";
import { Button } from "../../Components/Button";
import {
  LibraryFriendlyNames,
  LibraryType,
  Libraries,
  LibraryStoreNames
} from "../Libraries";
import { Listing } from "../Listing";
import { ActiveLibrary } from "./ActiveLibrary";
import { DeletePrompt } from "./DeletePrompt";
import { MovePrompt } from "./MovePrompt";
import { SelectedItemsViewForActiveTab } from "./SelectedItemsViewForActiveTab";
import { Selection } from "./useSelection";
import { Library } from "../useLibrary";
import { Store } from "../../Utility/Store";
import { ListingSelectionContext } from "./ListingSelectionContext";

type PromptTypeAndTargets = ["move" | "delete", Listing<Listable>[]] | null;

import { PersistentCharacter } from "../../../common/PersistentCharacter";

export function SelectedItemsManager(props: {
  activeTab: LibraryType;
  libraries: Libraries;
  editListing: (listing: Listing<Listable>) => void;
  librariesCommander: LibrariesCommander;
}) {
  const [promptTypeAndTargets, setPromptTypeAndTargets] =
    useState<PromptTypeAndTargets>(null);

  const [selectedCharacter, setSelectedCharacter] = useState<PersistentCharacter | null>(null);

  const selection = React.useContext(ListingSelectionContext);

  React.useEffect(() => {
    if (props.activeTab === "PersistentCharacters" && selection.selected.length === 1) {
      selection.selected[0].GetAsyncWithUpdatedId(char => {
        setSelectedCharacter(char);
      });
    } else {
      setSelectedCharacter(null);
    }
  }, [selection.selected, props.activeTab]);

  const ddbUrlMatch = selectedCharacter?.StatBlock?.Description?.match(/Imported from D&D Beyond: (.*)/);
  const ddbUrl = ddbUrlMatch ? ddbUrlMatch[1] : null;

  const preloadedContentSelected = selection.selected.some(
    l => l.Origin === "open5e" || l.Origin === "open5e-additional"
  );

  return (
    <div>
      {selection.selected.length > 0 && (
        <div style={{ flexFlow: "row", alignItems: "center" }}>
          <h2 style={{ flexGrow: 1 }}>
            Selected {LibraryFriendlyNames[props.activeTab]}
          </h2>
          {selection.selected.length === 1 && (
            <Button
              text="Edit"
              fontAwesomeIcon="edit"
              onClick={() => props.editListing(selection.selected[0])}
            />
          )}
          {ddbUrl && (
            <Button
              text="Resync"
              fontAwesomeIcon="sync"
              onClick={() => props.librariesCommander.ResyncPersistentCharacter(selection.selected[0], ddbUrl)}
            />
          )}
          <Button
            text="Move"
            fontAwesomeIcon="folder"
            onClick={() =>
              setPromptTypeAndTargets(["move", selection.selected])
            }
            disabled={preloadedContentSelected}
            tooltip={
              preloadedContentSelected
                ? "Cannot move preloaded content."
                : undefined
            }
          />
          <Button
            text="Delete"
            fontAwesomeIcon="trash"
            onClick={() =>
              setPromptTypeAndTargets(["delete", selection.selected])
            }
            disabled={preloadedContentSelected}
            tooltip={
              preloadedContentSelected
                ? "Cannot delete preloaded content. You can disable loading this content in the Content tab on the Settings pane."
                : undefined
            }
          />
          <Button
            text="Export"
            fontAwesomeIcon="download"
            onClick={() => exportSelectedItems(selection, props.activeTab)}
          />
        </div>
      )}
      <ActivePrompt
        promptTypeAndTargets={promptTypeAndTargets}
        library={ActiveLibrary(props.libraries, props.activeTab)}
        done={() => setPromptTypeAndTargets(null)}
      />
      <div className="c-library-manager__selection" style={{ flexShrink: 1 }}>
        <SelectedItemsViewForActiveTab
          selection={selection}
          activeTab={props.activeTab}
        />
      </div>
    </div>
  );
}

async function exportSelectedItems(
  selection: Selection<any>,
  activeTab: LibraryType
) {
  if (selection.selected.length > 0) {
    const blob = await Store.ExportListings(
      selection.selected,
      LibraryStoreNames[activeTab]
    );
    const firstListing: Listing<Listable> = selection.selected[0];
    const firstListingName = firstListing
      .Meta()
      .Name.toLocaleLowerCase()
      .replace(/ /gi, "-")
      .replace(/[^\w\s-]/gi, "");
    saveAs(
      blob,
      `improved-initiative-${firstListingName}-${selection.selected.length}.json`
    );
  }
}

function ActivePrompt(props: {
  promptTypeAndTargets: PromptTypeAndTargets;
  library: Library<Listable>;
  done: () => void;
}) {
  if (props.promptTypeAndTargets === null) {
    return null;
  }
  if (props.promptTypeAndTargets[0] === "move") {
    return <MovePrompt {...props} targets={props.promptTypeAndTargets[1]} />;
  }
  if (props.promptTypeAndTargets[0] === "delete") {
    return <DeletePrompt {...props} targets={props.promptTypeAndTargets[1]} />;
  }
  return null;
}
