// WIP
import { useContext, createContext, useState } from 'react';
import {} from 'firebase'; // Needed to have access to namespace for typing purposes

const FirebaseContext = createContext<firebase.app.App | undefined>( undefined );

function useFirestore() {
    const app = useContext( FirebaseContext );

    if ( !app )
        throw new Error( 'Unable to find Firebase context! Make sure you are using <FirebaseProvider> to provide your firebase app!' );

    return app.firestore();
}

function useRawCollection( collectionPath: string ) {
    const firestore = useFirestore();

    const collection = firestore.collection( collectionPath );

    return collection;
}

function useRawDocument( collection: firebase.firestore.CollectionReference, documentPath: string ) {
    const document = collection.doc( documentPath );

    return document;
}

interface DocumentMutations<TData> {
    delete: unknown; // TODO
    update: unknown; // TODO
    set: unknown; // TODO
}

interface DocumentMetadata {
    path: () => string;
    id: () => string;

    exists: () => boolean;

    hasPendingWrites: () => boolean;
    fromCache: () => boolean;

    error: () => unknown; // TODO
}

const reqs: { [id: string]: Promise<unknown> } = {};

type UseDocumentResult<TData> = [TData | undefined, DocumentMutations<TData>, DocumentMetadata];

export function useDocument<TData>( collectionPath: string, documentPath: string ): UseDocumentResult<TData> {
    const collection = useRawCollection( collectionPath );
    const document = useRawDocument( collection, documentPath );

    // TODO - hook this up into a caching layer
    const [stableId] = useState( Math.random().toString() );
    const [result, setResult] = useState<[TData | undefined, DocumentMutations<TData>, DocumentMetadata] | undefined>( undefined );

    // If we've loaded the data, return it
    if ( result )
        return result;

    // If we're loading the data already, Suspense it
    if ( reqs[stableId] )
        throw reqs[stableId];

    // Otherwise, kick off the load and Suspense it
    const promise = document.get().then(
        snapshot => resultFromSnapshot<TData>( snapshot ),
        error => resultFromError<TData>( error ),
    ).then(
        result => {
            delete reqs[stableId];
            setResult( result );
        },
    );

    reqs[stableId] = promise;
    throw reqs[stableId];
}

function resultFromSnapshot<TData>( snapshot: firebase.firestore.DocumentSnapshot ): UseDocumentResult<TData> {
    return [
        snapshot.data() as TData,
        {
            delete: snapshot.ref.delete,
            update: snapshot.ref.update,
            set: snapshot.ref.set,
        },
        {
            path: () => snapshot.ref.path,
            id: () => snapshot.id,
            exists: () => snapshot.exists,
            hasPendingWrites: () => snapshot.metadata.hasPendingWrites,
            fromCache: () => snapshot.metadata.fromCache,
            error: () => undefined,
        },
    ];
}

function resultFromError<TData>( error: any ): UseDocumentResult<TData> {
    return [
        undefined,
        {
            delete: () => { console.error( 'Cannot call delete() on a document that failed to load.' ) }, // Is this really true?
            update: () => { console.error( 'Cannot call update() on a document that failed to load.' ) }, // Is this really true?
            set: () => { console.error( 'Cannot call set() on a document that failed to load.' ) }, // Is this really true?
        },
        {
            // TODO - Are these sensible results for an error case? Should they throw? Should they not exist?
            path: () => '',
            id: () => '',
            exists: () => false,
            hasPendingWrites: () => false,
            fromCache: () => false,
            error: () => error,
        },
    ];
}
